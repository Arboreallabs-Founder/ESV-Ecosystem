-- Take one deal off one partner's earnings.
--
-- A deal lands on a partner's page because they sourced it or one of their investors is on it.
-- That is usually right and occasionally not: an investor who came in independently and was tagged
-- later, a deal the partner was taken off, a duplicate. The only way to make it read zero was to
-- set the split to 0, which leaves the deal on their page at ₹0 — an answer that invites the
-- question rather than settling it.
--
-- Excluding drops it from their page altogether.
--
-- ─── Why a flag and not a deleted share row ─────────────────────────────────
-- Deleting the active_deal_partner_shares row would take the deal off the page too, and would also
-- throw away the split that was agreed, so re-including means remembering what it used to be. The
-- flag keeps the configuration and changes only whether it counts.
--
-- ─── Why the function still returns excluded rows ───────────────────────────
-- Filtering them out in SQL would hide them from the admin as well, and an exclusion nobody can see
-- is one nobody can undo. The row comes back carrying is_excluded; the admin page shows it, struck
-- through, with a way back; getMyEarnings drops it before a partner ever sees it.

ALTER TABLE public.active_deal_partner_shares
  ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.active_deal_partner_shares.excluded IS
  'True takes this deal off the partner''s earnings page and out of their total. The split is kept, so including it again restores what was agreed.';

-- Partial index: the interesting set is the small one.
CREATE INDEX IF NOT EXISTS idx_adps_excluded
  ON public.active_deal_partner_shares(partner_id) WHERE excluded;

-- Signature changes (is_excluded is new), so dropped and recreated.
DROP FUNCTION IF EXISTS public.get_partner_earnings(uuid);

CREATE FUNCTION public.get_partner_earnings(p_partner_id uuid)
RETURNS TABLE (
  active_deal_id             uuid,
  deal_title                 text,
  accepted_at                timestamptz,
  org_total_earning          numeric,
  referred_earning           numeric,
  base_type                  text,
  split_pct                  numeric,
  share_amount               numeric,
  is_sourced                 boolean,
  transaction_base           numeric,
  success_base               numeric,
  carry_base                 numeric,
  other_base                 numeric,
  split_transaction_pct      numeric,
  split_success_pct          numeric,
  split_carry_pct            numeric,
  is_excluded                boolean
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
  WITH fee_earn AS (
    SELECT
      adi.active_deal_id,
      COALESCE(r.root_partner_id, i.referred_by_partner_id) AS root_partner_id,
      COALESCE(f.fee_kind, 'other') AS fee_kind,
      CASE WHEN f.is_enabled AND adi.investment_amount IS NOT NULL THEN
        COALESCE(f.rate, NULLIF(regexp_replace(COALESCE(fv.value,''), '[^0-9.]', '', 'g'), '')::numeric, 0)
          / 100.0 * adi.investment_amount
      ELSE 0 END AS earning
    FROM public.active_deal_investors adi
    JOIN public.investors i ON i.id = adi.investor_id
    LEFT JOIN public.investor_referral_roots r ON r.investor_id = i.id
    LEFT JOIN public.active_deal_investor_fees f ON f.active_deal_investor_id = adi.id
    LEFT JOIN public.active_deal_field_values fv
      ON fv.active_deal_id = adi.active_deal_id AND fv.field_id = f.source_field_id
  ),
  deal_earn AS (
    SELECT
      fe.active_deal_id,
      SUM(fe.earning)                                                              AS org_total,
      SUM(fe.earning) FILTER (WHERE fe.fee_kind = 'transaction')                   AS org_trx,
      SUM(fe.earning) FILTER (WHERE fe.fee_kind = 'success')                       AS org_succ,
      SUM(fe.earning) FILTER (WHERE fe.fee_kind = 'carry')                         AS org_carry,
      SUM(fe.earning) FILTER (WHERE fe.fee_kind = 'other')                         AS org_other,
      SUM(fe.earning) FILTER (WHERE fe.root_partner_id = p_partner_id)             AS ref_total,
      SUM(fe.earning) FILTER (WHERE fe.root_partner_id = p_partner_id AND fe.fee_kind = 'transaction') AS ref_trx,
      SUM(fe.earning) FILTER (WHERE fe.root_partner_id = p_partner_id AND fe.fee_kind = 'success')     AS ref_succ,
      SUM(fe.earning) FILTER (WHERE fe.root_partner_id = p_partner_id AND fe.fee_kind = 'carry')       AS ref_carry,
      SUM(fe.earning) FILTER (WHERE fe.root_partner_id = p_partner_id AND fe.fee_kind = 'other')       AS ref_other,
      BOOL_OR(fe.root_partner_id = p_partner_id)                                   AS has_referred
    FROM fee_earn fe
    GROUP BY fe.active_deal_id
  ),
  sourced AS (
    SELECT ad.id AS active_deal_id
    FROM public.active_deals ad
    JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
    JOIN public.form_links fl ON fl.id = pe.form_link_id
    JOIN public.users u ON u.id = fl.created_by
    WHERE u.franchise_partner_id = p_partner_id
  ),
  shaped AS (
    SELECT
      ad.id AS deal_id,
      pe.title AS title,
      ad.created_at AS created_at,
      COALESCE(de.org_total, 0)                                   AS org_total,
      COALESCE(de.ref_total, 0)                                   AS ref_total,
      COALESCE(s.base_type, 'referred')                           AS base_type,
      COALESCE(s.split_pct, v_standard)                           AS base_split,
      (src.active_deal_id IS NOT NULL)                            AS is_sourced,
      COALESCE(s.excluded, false)                                 AS excluded,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_trx, 0)   ELSE COALESCE(de.ref_trx, 0)   END AS b_trx,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_succ, 0)  ELSE COALESCE(de.ref_succ, 0)  END AS b_succ,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_carry, 0) ELSE COALESCE(de.ref_carry, 0) END AS b_carry,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_other, 0) ELSE COALESCE(de.ref_other, 0) END AS b_other,
      COALESCE(s.split_transaction_pct, s.split_pct, v_standard)  AS p_trx,
      COALESCE(s.split_success_pct,     s.split_pct, v_standard)  AS p_succ,
      COALESCE(s.split_carry_pct,       s.split_pct, v_standard)  AS p_carry,
      COALESCE(s.split_pct, v_standard)                           AS p_other
    FROM public.active_deals ad
    JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
    JOIN public.pipelines p ON p.id = pe.pipeline_id
    LEFT JOIN deal_earn de ON de.active_deal_id = ad.id
    LEFT JOIN sourced src ON src.active_deal_id = ad.id
    LEFT JOIN public.active_deal_partner_shares s
      ON s.active_deal_id = ad.id AND s.partner_id = p_partner_id
    WHERE p.org_id = v_partner_org
      AND (src.active_deal_id IS NOT NULL OR COALESCE(de.has_referred, false))
  )
  SELECT
    sh.deal_id,
    sh.title,
    sh.created_at,
    sh.org_total::numeric,
    sh.ref_total::numeric,
    sh.base_type,
    sh.base_split::numeric,
    -- An excluded deal is worth nothing to this partner. Zeroed here rather than left to the
    -- caller, so no reader of this function can total a column that should not have been counted.
    CASE WHEN sh.excluded THEN 0 ELSE
      (  sh.p_trx   / 100.0 * sh.b_trx
       + sh.p_succ  / 100.0 * sh.b_succ
       + sh.p_carry / 100.0 * sh.b_carry
       + sh.p_other / 100.0 * sh.b_other )
    END::numeric,
    sh.is_sourced,
    sh.b_trx::numeric,
    sh.b_succ::numeric,
    sh.b_carry::numeric,
    sh.b_other::numeric,
    sh.p_trx::numeric,
    sh.p_succ::numeric,
    sh.p_carry::numeric,
    sh.excluded
  FROM shaped sh
  ORDER BY sh.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_earnings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_earnings(uuid) TO authenticated;
