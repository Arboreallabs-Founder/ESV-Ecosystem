-- GST on a ledger line.
--
-- A partner invoices us for their share and the invoice carries tax, so the amount that leaves the
-- bank is not the amount that settles what we owe them. Recording only one of the two means the
-- ledger reconciles against neither: against the bank it is short by the tax, and against the
-- earnings it is over by it.
--
-- ─── GST does not move the balances ─────────────────────────────────────────
-- This is the decision worth stating plainly. `amount` stays the base — what is owed, what is
-- settled, what comes off the buy-in. `gst_amount` is tax on top, and it changes only the cash.
--
-- So a payout of 2,68,000 + 48,240 GST settles 2,68,000 of earnings and moves 3,16,240 through the
-- bank. If GST reduced the earnings owed, a partner would be short by the tax they then have to
-- remit, and the buy-in would be worked off faster than it was actually paid down.
--
-- ─── One stored number, not a rate ──────────────────────────────────────────
-- The amount is stored, not a percentage. Rates change, are rounded differently on different
-- invoices, and are sometimes split across CGST and SGST that do not sum to a clean percentage of
-- the base. The invoice says a number; the ledger stores that number. The form offers an 18%
-- quick-fill so nobody is doing arithmetic, but what it writes is the figure, not the rate.
--
-- Worth noting against the FWDA import: PJ's per-row cells summed to 2,68,000 against a header cell
-- reading 2,90,000, a gap of 8.2% that is not 18% of the base or of either fee component. That gap
-- is still unexplained, and this column does not explain it — it gives somewhere to record the tax
-- once the right figure is known.

ALTER TABLE public.partner_ledger_entries
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC;

DO $$ BEGIN
  ALTER TABLE public.partner_ledger_entries
    ADD CONSTRAINT partner_ledger_gst_nonneg
    CHECK (gst_amount IS NULL OR gst_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.partner_ledger_entries.gst_amount IS
  'Tax on top of amount, as the invoice states it. Never part of a balance: amount is what settles, gst_amount is only cash. NULL where the line carries no tax.';

-- ─── Summary: the base and the cash, side by side ───────────────────────────
-- Signature changes, so dropped and recreated.
DROP FUNCTION IF EXISTS public.get_partner_ledger_summary(uuid);

CREATE FUNCTION public.get_partner_ledger_summary(p_partner_id uuid)
RETURNS TABLE (
  buy_in_total        numeric,
  paid_total          numeric,
  adjusted_total      numeric,
  payout_total        numeric,
  buy_in_outstanding  numeric,
  earnings_settled    numeric,
  gst_total           numeric,
  payout_gst_total    numeric,
  payout_with_gst     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role           user_role;
  v_org            uuid;
  v_partner_org    uuid;
  v_caller_partner uuid;
BEGIN
  v_role := get_user_role();
  v_org  := get_user_org_id();

  SELECT fp.org_id INTO v_partner_org
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
  WITH t AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'buy_in'), 0)      AS buy_in,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payment'), 0)     AS paid,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'adjustment'), 0)  AS adjusted,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payout'), 0)      AS payout,
      COALESCE(SUM(gst_amount), 0)                                       AS gst_all,
      COALESCE(SUM(gst_amount) FILTER (WHERE entry_type = 'payout'), 0)  AS gst_payout
    FROM public.partner_ledger_entries
    WHERE partner_id = p_partner_id
  )
  SELECT
    t.buy_in, t.paid, t.adjusted, t.payout,
    -- Balances are built from the base only. GST is deliberately absent from both of these.
    (t.buy_in - t.paid - t.adjusted),
    (t.payout + t.adjusted),
    t.gst_all,
    t.gst_payout,
    -- What actually left the bank, which is the figure a statement is reconciled against.
    (t.payout + t.gst_payout)
  FROM t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_ledger_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_ledger_summary(uuid) TO authenticated;
