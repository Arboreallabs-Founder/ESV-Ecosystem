-- Leave balances: per-person entitlement + a manual "already used" baseline (for backfilling
-- history from before this system existed) for Earned/Sick/My Day/Compensatory leave — Unpaid
-- is intentionally excluded, since it's uncapped by definition. Informational only — a request
-- can still be submitted/approved past the remaining balance; nothing here blocks that. HR sets
-- these on the new "Balances" tab on /approvals; "remaining" itself is computed at read time
-- (entitled - manual_used - sum of approved leave_requests days) rather than stored, so it never
-- drifts out of sync with actual approvals — see src/lib/leave-balances.ts.

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id),
  user_id           UUID NOT NULL REFERENCES public.users(id),
  leave_type        leave_type NOT NULL,
  entitled_days     NUMERIC NOT NULL DEFAULT 0,
  manual_used_days  NUMERIC NOT NULL DEFAULT 0,
  updated_by        UUID REFERENCES public.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_org ON public.leave_balances(org_id);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave balances select" ON public.leave_balances;
CREATE POLICY "Leave balances select" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND (public.get_user_role() IN ('founder', 'admin', 'hr') OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Leave balances insert" ON public.leave_balances;
CREATE POLICY "Leave balances insert" ON public.leave_balances
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Leave balances update" ON public.leave_balances;
CREATE POLICY "Leave balances update" ON public.leave_balances
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));
