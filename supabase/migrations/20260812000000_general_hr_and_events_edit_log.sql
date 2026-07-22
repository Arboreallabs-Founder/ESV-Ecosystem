-- General can now create/edit HR policies and events (not delete) — widen the existing
-- INSERT/UPDATE policies to include 'general'; DELETE policies are untouched (admin-only).
DROP POLICY IF EXISTS "Admins create hr policies" ON public.hr_policies;
CREATE POLICY "Admins create hr policies" ON public.hr_policies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Admins update hr policies" ON public.hr_policies;
CREATE POLICY "Admins update hr policies" ON public.hr_policies
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Admins manage bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins manage bulletin posts" ON public.bulletin_posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Admins update bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins update bulletin posts" ON public.bulletin_posts
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

-- Audit trail for HR policy edits — same append-only pattern as investor_edit_log,
-- rendered/exported as text on the admin Activity Log page (founder/admin only).
CREATE TABLE IF NOT EXISTS public.hr_policy_edit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      UUID REFERENCES public.hr_policies(id) ON DELETE SET NULL,
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  edited_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  policy_title   TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('created', 'updated')),
  changes        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_policy_edit_log_org_idx ON public.hr_policy_edit_log(org_id, created_at DESC);

ALTER TABLE public.hr_policy_edit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read hr policy edit log" ON public.hr_policy_edit_log;
CREATE POLICY "Admins read hr policy edit log" ON public.hr_policy_edit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Internal write hr policy edit log" ON public.hr_policy_edit_log;
CREATE POLICY "Internal write hr policy edit log" ON public.hr_policy_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general'));

-- Audit trail for event edits — same pattern.
CREATE TABLE IF NOT EXISTS public.event_edit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES public.bulletin_posts(id) ON DELETE SET NULL,
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  edited_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  event_title    TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('created', 'updated')),
  changes        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_edit_log_org_idx ON public.event_edit_log(org_id, created_at DESC);

ALTER TABLE public.event_edit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read event edit log" ON public.event_edit_log;
CREATE POLICY "Admins read event edit log" ON public.event_edit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Internal write event edit log" ON public.event_edit_log;
CREATE POLICY "Internal write event edit log" ON public.event_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general'));
