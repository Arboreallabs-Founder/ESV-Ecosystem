-- Expense reimbursement requests: same request/approval shape as leave_requests, plus a required
-- invoice file attachment. Uses the exact private-bucket + org-prefixed-path pattern established
-- by the `deal-desk` bucket (20260712000000_deal_desk.sql) — client uploads directly to Storage,
-- the row only ever stores the resulting object path, reads are resolved to signed URLs at fetch
-- time (see src/lib/expense-requests.ts).

DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('travel', 'meals', 'software', 'office_supplies', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.expense_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  requester_id  UUID NOT NULL REFERENCES public.users(id),
  expense_type  expense_type NOT NULL,
  amount        NUMERIC NOT NULL CHECK (amount > 0),
  description   TEXT,
  invoice_path  TEXT NOT NULL,
  status        approval_status NOT NULL DEFAULT 'pending',
  decided_by    UUID REFERENCES public.users(id),
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_requests_org ON public.expense_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_requester ON public.expense_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON public.expense_requests(org_id, status);

ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expense requests select" ON public.expense_requests;
CREATE POLICY "Expense requests select" ON public.expense_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder', 'admin', 'hr') OR requester_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Expense requests insert" ON public.expense_requests;
CREATE POLICY "Expense requests insert" ON public.expense_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND requester_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Expense requests update" ON public.expense_requests;
CREATE POLICY "Expense requests update" ON public.expense_requests
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

DROP POLICY IF EXISTS "Expense requests delete" ON public.expense_requests;
CREATE POLICY "Expense requests delete" ON public.expense_requests
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

-- ── Storage: private `expenses` bucket, org-prefixed object paths ─────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('expenses', 'expenses', false)
ON CONFLICT (id) DO NOTHING;

-- Object paths are `{org_id}/expenses/{requester_id}/{uuid}.{ext}`.
DROP POLICY IF EXISTS "Expenses objects select" ON storage.objects;
CREATE POLICY "Expenses objects select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'expenses' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Expenses objects insert" ON storage.objects;
CREATE POLICY "Expenses objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expenses' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Expenses objects update" ON storage.objects;
CREATE POLICY "Expenses objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'expenses' AND (storage.foldername(name))[1] = public.get_user_org_id()::text)
  WITH CHECK (bucket_id = 'expenses' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Expenses objects delete" ON storage.objects;
CREATE POLICY "Expenses objects delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'expenses' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
