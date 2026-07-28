-- Reworks leave balances to match the redesigned Balances tab:
--   1. Entitlement becomes an ORG-WIDE standard per leave type, not a per-person number. One
--      policy row, everyone measured against it.
--   2. Half-days are supported throughout — balances and requests both move in 0.5 steps.
--
-- All four scored leave types stay in DAYS (compensatory included) — a single unit everywhere
-- avoids day↔hour conversion, which would otherwise need an assumed hours-per-day constant.
--
-- leave_balances.entitled_days is left in place but is no longer read: entitlement now comes from
-- leave_policy. Dropping a column on a live table gains nothing here and would be irreversible,
-- so it's simply abandoned. Only manual_used_days is still written.

CREATE TABLE IF NOT EXISTS public.leave_policy (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL UNIQUE REFERENCES public.organizations(id),
  earned_days        NUMERIC NOT NULL DEFAULT 20,
  sick_days          NUMERIC NOT NULL DEFAULT 10,
  my_day_days        NUMERIC NOT NULL DEFAULT 2,
  compensatory_days  NUMERIC NOT NULL DEFAULT 20,
  updated_by         UUID REFERENCES public.users(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS leave_policy_set_updated_at ON public.leave_policy;
CREATE TRIGGER leave_policy_set_updated_at
  BEFORE UPDATE ON public.leave_policy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed for every existing org so the tab never has a "no policy yet" state.
INSERT INTO public.leave_policy (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.leave_policy ENABLE ROW LEVEL SECURITY;

-- Everyone internal can read the policy (they need it to see their own remaining balance).
DROP POLICY IF EXISTS "Internal view leave policy" ON public.leave_policy;
CREATE POLICY "Internal view leave policy"
  ON public.leave_policy FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

DROP POLICY IF EXISTS "Leave policy insert" ON public.leave_policy;
CREATE POLICY "Leave policy insert"
  ON public.leave_policy FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Leave policy update" ON public.leave_policy;
CREATE POLICY "Leave policy update"
  ON public.leave_policy FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

-- ─── Half-days on leave requests ────────────────────────────────────────────
-- Only meaningful when start_date = end_date; a half-day counts as 0.5 against the balance.
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_half_day_single_day;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_half_day_single_day
  CHECK (NOT is_half_day OR start_date = end_date);
