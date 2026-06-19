-- Per-deal, per-partner fee-split configuration + the earnings aggregation function.
-- A partner's earning on a deal = split% × base, where base is the org's total earning on the
-- deal or the earning from the partner's referred investors. split% defaults to the partner's
-- Standard Fee Split (franchise_partners.success_fee_split_pct) and is overridable per deal.

CREATE TABLE IF NOT EXISTS public.active_deal_partner_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_deal_id uuid NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,
  partner_id     uuid NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  base_type      text NOT NULL DEFAULT 'referred' CHECK (base_type IN ('total','referred')),
  split_pct      numeric,  -- NULL = use the partner's Standard Fee Split
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (active_deal_id, partner_id)
);

CREATE INDEX IF NOT EXISTS active_deal_partner_shares_partner_idx
  ON public.active_deal_partner_shares(partner_id);
CREATE INDEX IF NOT EXISTS active_deal_partner_shares_deal_idx
  ON public.active_deal_partner_shares(active_deal_id);

ALTER TABLE public.active_deal_partner_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org internal partner shares access" ON public.active_deal_partner_shares;
CREATE POLICY "Org internal partner shares access"
  ON public.active_deal_partner_shares FOR ALL TO authenticated
  USING (
    is_super_admin() OR (
      get_user_role() = ANY (ARRAY['founder'::user_role,'admin'::user_role,'associate'::user_role])
      AND org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      get_user_role() = ANY (ARRAY['founder'::user_role,'admin'::user_role,'associate'::user_role])
      AND org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Partners read own deal shares" ON public.active_deal_partner_shares;
CREATE POLICY "Partners read own deal shares"
  ON public.active_deal_partner_shares FOR SELECT TO authenticated
  USING (
    get_user_role() = 'franchise_partner'::user_role
    AND partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  );

-- ── Earnings aggregator (single source of truth for the fee math) ─────────────
-- Mirrors computeFeeAmount/totalEarnings in DealInvestorsSection.tsx: per-investor earning =
-- sum over enabled fees of (rate ?? deal field value)/100 * investment_amount (when amount set).
-- Returns one row per deal the partner is tied to (sourced via their link, or a referred
-- investor of theirs is investing). SECURITY DEFINER so partners get only their final numbers
-- without read access to other investors' rows.
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
      adi.is_investing,
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
    GROUP BY adi.active_deal_id, adi.id, i.referred_by_partner_id, adi.is_investing, adi.investment_amount
  ),
  deal_earn AS (
    SELECT
      ie.active_deal_id,
      SUM(ie.earning) AS org_total,
      SUM(CASE WHEN ie.referred_by_partner_id = p_partner_id THEN ie.earning ELSE 0 END) AS referred,
      BOOL_OR(ie.referred_by_partner_id = p_partner_id AND ie.is_investing) AS has_referred_investing
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
    AND (src.active_deal_id IS NOT NULL OR COALESCE(de.has_referred_investing, false))
  ORDER BY ad.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_partner_earnings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_earnings(uuid) TO authenticated;
