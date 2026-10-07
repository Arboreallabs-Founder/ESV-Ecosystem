-- A partner's account with us: the buy-in, what they have paid against it, and what we have paid
-- them.
--
-- An SGP buys in. That buy-in is settled two ways — they pay it, or we hold back earnings they
-- would otherwise have been paid and put those against it. Until now neither existed anywhere: the
-- app could say what a partner had *earned* and nothing about what had actually moved, so "what do
-- we owe Robin" and "what does Robin still owe us" were questions for a spreadsheet.
--
-- ─── One table of lines, not a balance column ───────────────────────────────
-- A stored balance is a number that disagrees with its own history the first time somebody edits a
-- row. Every balance here is derived by summing lines, so the ledger and the total cannot differ.
-- The buy-in is itself a line, set by an admin, rather than a field on franchise_partners: a
-- partner whose terms are renegotiated gets a second line and keeps the first, which is the record
-- of what was agreed when.
--
-- ─── The four kinds, and which direction each moves ─────────────────────────
--   buy_in      what the partner owes us. Raises their outstanding buy-in.
--   payment     cash from the partner. Reduces the buy-in.
--   adjustment  earnings withheld and applied to the buy-in instead of being paid out.
--               Reduces the buy-in AND counts as earnings settled — it is the one line that does
--               two jobs, and it is the mechanism this whole table exists for.
--   payout      cash from us to the partner, settling earnings. `reference` is the receipt number.
--
-- amount is always positive; the kind decides the direction. A signed amount means every reader has
-- to know the sign convention, and one of them eventually does not.

DO $$ BEGIN
  CREATE TYPE partner_ledger_entry_type AS ENUM ('buy_in', 'payment', 'adjustment', 'payout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.partner_ledger_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id  UUID NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,

  entry_type  partner_ledger_entry_type NOT NULL,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Receipt or UTR. The reason for this table's existence on the payout side: "we paid him" is not
  -- an answer anyone can reconcile against a bank statement.
  reference   TEXT,
  -- The deal the money relates to, where there is one. Optional: a payout may settle several deals
  -- at once, and a buy-in relates to none.
  active_deal_id UUID REFERENCES public.active_deals(id) ON DELETE SET NULL,
  note        TEXT,

  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.partner_ledger_entries IS
  'Every movement on a partner account: the buy-in charged, payments against it, earnings adjusted into it, and payouts made. Balances are summed from here, never stored.';
COMMENT ON COLUMN public.partner_ledger_entries.amount IS
  'Always positive. entry_type decides the direction — a signed amount only works while every reader remembers the convention.';

CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner
  ON public.partner_ledger_entries(partner_id, entry_date DESC);

-- ─── Who sees and writes it ─────────────────────────────────────────────────
ALTER TABLE public.partner_ledger_entries ENABLE ROW LEVEL SECURITY;

-- A partner reads their own account and writes nothing. Being able to add a line here would be
-- being able to decide you had paid.
DROP POLICY IF EXISTS "Partners read own ledger" ON public.partner_ledger_entries;
CREATE POLICY "Partners read own ledger"
  ON public.partner_ledger_entries FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND partner_id = (SELECT u.franchise_partner_id FROM public.users u WHERE u.id = auth.uid())
  );

-- Associates read: they answer "has this been paid" without being able to decide it.
DROP POLICY IF EXISTS "Internal read partner ledger" ON public.partner_ledger_entries;
CREATE POLICY "Internal read partner ledger"
  ON public.partner_ledger_entries FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (public.get_user_role() IN ('founder', 'admin', 'associate')
        AND org_id = public.get_user_org_id())
  );

DROP POLICY IF EXISTS "Admins write partner ledger" ON public.partner_ledger_entries;
CREATE POLICY "Admins write partner ledger"
  ON public.partner_ledger_entries FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.get_user_role() IN ('founder', 'admin') AND org_id = public.get_user_org_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_role() IN ('founder', 'admin') AND org_id = public.get_user_org_id())
  );

-- ─── The balances ───────────────────────────────────────────────────────────
-- Summed, never stored. Returns a row even for a partner with no lines at all, so the page has
-- zeroes to render rather than a missing object to guard against.
--
-- SECURITY DEFINER with the same gate as get_partner_earnings: a partner may ask about themselves,
-- internal roles about anyone in their org. The two are read side by side and must not disagree
-- about who may look.
CREATE OR REPLACE FUNCTION public.get_partner_ledger_summary(p_partner_id uuid)
RETURNS TABLE (
  buy_in_total        numeric,
  paid_total          numeric,
  adjusted_total      numeric,
  payout_total        numeric,
  buy_in_outstanding  numeric,
  earnings_settled    numeric
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
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'buy_in'), 0)     AS buy_in,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payment'), 0)    AS paid,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'adjustment'), 0) AS adjusted,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payout'), 0)     AS payout
    FROM public.partner_ledger_entries
    WHERE partner_id = p_partner_id
  )
  SELECT
    t.buy_in, t.paid, t.adjusted, t.payout,
    -- Not clamped at zero: an overpaid buy-in is a real state and showing it as nil would hide
    -- money we owe back.
    (t.buy_in - t.paid - t.adjusted),
    -- An adjustment settles earnings just as a payout does; that is the whole point of it.
    (t.payout + t.adjusted)
  FROM t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_ledger_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_ledger_summary(uuid) TO authenticated;
