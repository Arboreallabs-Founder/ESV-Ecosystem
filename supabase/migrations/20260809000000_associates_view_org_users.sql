-- The Investor form's ESV POC picker already queries for founder/admin/associate names
-- (investors/page.tsx), but associates could only ever see their OWN row back — the only
-- SELECT policies on users were "view own record" and "founder/admin view org users",
-- so RLS silently filtered every other row out before the picker ever saw them.
-- Additive: associates get the same org-wide read as founder/admin already have;
-- self-view and founder/admin-view policies are untouched.
DROP POLICY IF EXISTS "Associates view org users" ON public.users;
CREATE POLICY "Associates view org users" ON public.users
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'associate');
