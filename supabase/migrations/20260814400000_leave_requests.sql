-- Leave requests: a simple request/approval log, no balance or accrual tracking. Any internal
-- role can submit; founder/admin/hr can approve or reject; a requester can edit/withdraw their
-- own request while it's still pending.

DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM ('earned', 'sick', 'my_day', 'compensatory', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  requester_id  UUID NOT NULL REFERENCES public.users(id),
  leave_type    leave_type NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        approval_status NOT NULL DEFAULT 'pending',
  decided_by    UUID REFERENCES public.users(id),
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON public.leave_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_requester ON public.leave_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(org_id, status);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave requests select" ON public.leave_requests;
CREATE POLICY "Leave requests select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder', 'admin', 'hr') OR requester_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Leave requests insert" ON public.leave_requests;
CREATE POLICY "Leave requests insert" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND requester_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Leave requests update" ON public.leave_requests;
CREATE POLICY "Leave requests update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        OR (requester_id = auth.uid() AND status = 'pending')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        OR requester_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Leave requests delete" ON public.leave_requests;
CREATE POLICY "Leave requests delete" ON public.leave_requests
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        OR (requester_id = auth.uid() AND status = 'pending')
      )
    )
  );
