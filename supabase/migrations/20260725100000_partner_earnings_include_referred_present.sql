-- Broaden deal relevance: include a deal whenever the partner's referred investor is PRESENT on
-- the deal (added to active_deal_investors), not only when that investor is marked investing.
CREATE OR REPLACE FUNCTION public.get_partner_earnings(p_partner_id uuid)
RETURNS TABLE (
  active_deal_id     uuid,
  deal_title         text,
  accepted_at        timestamptz,
  org_total_earning  numeric,
  referred_earning   numeric,
  base_type          text,
  split_pct          numeric,
  share_amount       numeric,
  is_sourced         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role           user_role;
  v_org            uuid;
  v_partner_org    uuid;
  v_standard       numeric;
  v_caller_partner uuid;
BEGIN
  v_role := get_user_role();
  v_org  := get_user_org_id();

  SELECT fp.org_id, fp.success_fee_split_pct INTO v_partner_org, v_standard
  FROM public.franchise_partners fp WHERE fp.id = p_partner_id;
  IF v_partner_org IS NULL THEN RAISE EXCEPTION 'Partner not found'; END IF;

  IF NOT is_super_admin() AND v_partner_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_role = 'franchise_partner' THEN
    SELECT u.franchise_partner_id INTO v_caller_partner FROM public.users u WHERE u.id = auth.uid();
    IF v_caller_partner IS DISTINCT FROM p_partner_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  ELSIF v_role NOT IN ('founder','admin','associate') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH inv_earn AS (
    SELECT
      adi.active_deal_id,
      adi.id AS adi_id,
      i.referred_by_partner_id,
      COALESCE(SUM(
        CASE WHEN f.is_enabled AND adi.investment_amount IS NOT NULL THEN
          COALESCE(f.rate, NULLIF(regexp_replace(COALESCE(fv.value,''), '[^0-9.]', '', 'g'), '')::numeric, 0)
            / 100.0 * adi.investment_amount
        ELSE 0 END
      ), 0) AS earning
    FROM public.active_deal_investors adi
    JOIN public.investors i ON i.id = adi.investor_id
    LEFT JOIN public.active_deal_investor_fees f ON f.active_deal_investor_id = adi.id
    LEFT JOIN public.active_deal_field_values fv
      ON fv.active_deal_id = adi.active_deal_id AND fv.field_id = f.source_field_id
    GROUP BY adi.active_deal_id, adi.id, i.referred_by_partner_id, adi.investment_amount
  ),
  deal_earn AS (
    SELECT
      ie.active_deal_id,
      SUM(ie.earning) AS org_total,
      SUM(CASE WHEN ie.referred_by_partner_id = p_partner_id THEN ie.earning ELSE 0 END) AS referred,
      BOOL_OR(ie.referred_by_partner_id = p_partner_id) AS has_referred
    FROM inv_earn ie
    GROUP BY ie.active_deal_id
  ),
  sourced AS (
    SELECT ad.id AS active_deal_id
    FROM public.active_deals ad
    JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
    JOIN public.form_links fl ON fl.id = pe.form_link_id
    JOIN public.users u ON u.id = fl.created_by
    WHERE u.franchise_partner_id = p_partner_id
  )
  SELECT
    ad.id,
    pe.title,
    ad.created_at,
    COALESCE(de.org_total, 0)::numeric,
    COALESCE(de.referred, 0)::numeric,
    COALESCE(s.base_type, 'referred'),
    COALESCE(s.split_pct, v_standard)::numeric,
    (COALESCE(s.split_pct, v_standard) / 100.0 *
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
        THEN COALESCE(de.org_total, 0) ELSE COALESCE(de.referred, 0) END)::numeric,
    (src.active_deal_id IS NOT NULL)
  FROM public.active_deals ad
  JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
  JOIN public.pipelines p ON p.id = pe.pipeline_id
  LEFT JOIN deal_earn de ON de.active_deal_id = ad.id
  LEFT JOIN sourced src ON src.active_deal_id = ad.id
  LEFT JOIN public.active_deal_partner_shares s
    ON s.active_deal_id = ad.id AND s.partner_id = p_partner_id
  WHERE p.org_id = v_partner_org
    AND (src.active_deal_id IS NOT NULL OR COALESCE(de.has_referred, false))
  ORDER BY ad.created_at DESC;
END;
$$;
