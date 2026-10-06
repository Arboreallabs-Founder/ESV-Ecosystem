-- A partner's cut differs by which fee it is.
--
-- The model so far: one split percentage applied to one base. That is true of PJ, HS and PR, who
-- take 50% of both the transaction fee and the success fee. It is false of everyone else:
--
--   Robin     25% of the transaction fee,  nothing of the success fee
--   RD        45% of the transaction fee,  nothing of the success fee
--   Nishant   50% of the transaction fee,  nothing of the success fee
--   Soonicorn nothing of the transaction fee,  60% of the success fee
--   Signal    nothing of the transaction fee,  60% of the success fee
--
-- Run Robin through the old model and FWDA reads 25% x (4,50,000 + 3,00,000 + 1,80,000 + 1,20,000)
-- = 2,62,500. He is owed 1,57,500 — 25% of the transaction fees alone. A fee page that is confidently
-- wrong by a lakh is worse than one that is blank, so this is fixed before any of that history is
-- imported.
--
-- ─── Backward compatible by construction ────────────────────────────────────
-- Every per-kind split is nullable and falls back to the existing split_pct, which falls back to the
-- partner's standard split. With no per-kind value set anywhere — i.e. every deal that exists today
-- — the arithmetic is identical to before, kind by kind. Nothing recomputes until somebody says a
-- partner's cut of one fee differs from their cut of another.

-- ─── 1. Fees know what kind of fee they are ─────────────────────────────────
-- 'other' is the default, not 'transaction'. Existing rows were created when the distinction did not
-- exist, and guessing which they are would silently re-bucket live money; 'other' keeps them on the
-- old single split until someone classifies them.
ALTER TABLE public.active_deal_investor_fees
  ADD COLUMN IF NOT EXISTS fee_kind TEXT NOT NULL DEFAULT 'other';

DO $$ BEGIN
  ALTER TABLE public.active_deal_investor_fees
    ADD CONSTRAINT active_deal_investor_fees_kind_check
    CHECK (fee_kind IN ('transaction', 'success', 'carry', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.active_deal_investor_fees.fee_kind IS
  'Which fee this is, so a partner can take a different cut of each. Defaults to other, which uses the single split_pct exactly as before.';

-- ─── 2. A partner's cut, per kind ───────────────────────────────────────────
ALTER TABLE public.active_deal_partner_shares
  ADD COLUMN IF NOT EXISTS split_transaction_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS split_success_pct     NUMERIC,
  ADD COLUMN IF NOT EXISTS split_carry_pct       NUMERIC;

COMMENT ON COLUMN public.active_deal_partner_shares.split_transaction_pct IS
  'Partner cut of transaction fees on this deal. NULL falls back to split_pct, then to the partner standard split. Zero is a real answer and means they take none.';

-- ─── 3. Earnings, computed kind by kind ─────────────────────────────────────
-- Signature changes (the breakdown columns are new), so the old one is dropped rather than replaced.
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
  -- What the share is actually made of. Without these the admin page shows a number nobody can
  -- check against the fee sheet, which is how the old model's error survived unnoticed.
  transaction_base           numeric,
  success_base               numeric,
  carry_base                 numeric,
  other_base                 numeric,
  split_transaction_pct      numeric,
  split_success_pct          numeric,
  split_carry_pct            numeric
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
  -- One row per FEE now, not per investor: the kind is a property of the fee, so summing to the
  -- investor first would throw away the distinction this whole migration exists for.
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
      -- The base each kind is charged against, picked once by the deal's base selector.
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_trx, 0)   ELSE COALESCE(de.ref_trx, 0)   END AS b_trx,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_succ, 0)  ELSE COALESCE(de.ref_succ, 0)  END AS b_succ,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_carry, 0) ELSE COALESCE(de.ref_carry, 0) END AS b_carry,
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
           THEN COALESCE(de.org_other, 0) ELSE COALESCE(de.ref_other, 0) END AS b_other,
      -- Each kind falls back to the single split, which falls back to the partner standard. This is
      -- what keeps every existing deal returning exactly what it returned before.
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
    (  sh.p_trx   / 100.0 * sh.b_trx
     + sh.p_succ  / 100.0 * sh.b_succ
     + sh.p_carry / 100.0 * sh.b_carry
     + sh.p_other / 100.0 * sh.b_other )::numeric,
    sh.is_sourced,
    sh.b_trx::numeric,
    sh.b_succ::numeric,
    sh.b_carry::numeric,
    sh.b_other::numeric,
    sh.p_trx::numeric,
    sh.p_succ::numeric,
    sh.p_carry::numeric
  FROM shaped sh
  ORDER BY sh.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_earnings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_earnings(uuid) TO authenticated;
