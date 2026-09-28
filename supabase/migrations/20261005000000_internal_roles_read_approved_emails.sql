-- fetchAllUsers() (src/lib/partners.ts) reads approved_emails to exclude revoked-but-not-deleted
-- accounts from any picker built off the full user list — the @mention picker on personal to-dos
-- is the newest caller, but the Weekly Update page's founder filter has used it since before this
-- migration. "Org admins manage approved emails" (20260700300000) only grants founder/admin/
-- super_admin SELECT, so for every other internal role that inner query silently returns zero rows
-- (RLS filters, it doesn't error) and fetchAllUsers() filters out every user as a result — the
-- picker ends up empty for an associate/general/hr caller, not just missing the exclusion.
--
-- Same shape as "Internal roles view org users" (20260821000000) on the users table: a narrow,
-- additive SELECT policy for the same five internal roles, OR'd in alongside the existing
-- admin-only FOR ALL policy rather than replacing it — so INSERT/UPDATE/DELETE on the allowlist
-- (who can approve a login) stays founder/admin only. approved_emails holds addresses, not
-- anything more sensitive than what internal staff already see on each other's user records.
DROP POLICY IF EXISTS "Internal roles read approved emails" ON public.approved_emails;
CREATE POLICY "Internal roles read approved emails"
  ON public.approved_emails FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
  );
