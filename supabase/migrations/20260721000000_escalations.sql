-- Escalations module: internal staff (associate/admin) raise a query directed to one
-- recipient (a founder or a partner), optionally linked to a deal/entry/task/investor,
-- tracked Open → Acknowledged → Resolved. Founders/admins have org oversight; partners
-- see only escalations addressed to them.

DO $$ BEGIN
  CREATE TYPE escalation_status AS ENUM ('Open', 'Acknowledged', 'Resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.escalations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id),
  raised_by         UUID NOT NULL REFERENCES public.users(id),
  recipient_user_id UUID NOT NULL REFERENCES public.users(id),
  subject           TEXT NOT NULL,
  body              TEXT,
  status            escalation_status NOT NULL DEFAULT 'Open',
  linked_type       TEXT CHECK (linked_type IN ('active_deal','pipeline_entry','task','investor')),
  linked_id         UUID,
  linked_title      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalations_org        ON public.escalations(org_id);
CREATE INDEX IF NOT EXISTS idx_escalations_recipient  ON public.escalations(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_raised_by  ON public.escalations(raised_by);

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escalations select" ON public.escalations;
CREATE POLICY "Escalations select" ON public.escalations
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR raised_by = auth.uid()
        OR recipient_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Escalations insert" ON public.escalations;
CREATE POLICY "Escalations insert" ON public.escalations
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'admin')
    AND raised_by = auth.uid()
  );

DROP POLICY IF EXISTS "Escalations update" ON public.escalations;
CREATE POLICY "Escalations update" ON public.escalations
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR raised_by = auth.uid()
        OR recipient_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR raised_by = auth.uid()
        OR recipient_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Escalations delete" ON public.escalations;
CREATE POLICY "Escalations delete" ON public.escalations
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR raised_by = auth.uid()
      )
    )
  );
