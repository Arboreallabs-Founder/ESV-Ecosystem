-- Founders and admins can read every personal to-do in their organisation, not only the ones filed
-- into a work week or a day plan (decided 28 November 2026, so a founder's Claude connector can pull
-- each person's list: the team_todos tool).
--
-- Reading only. Changing, ticking or deleting someone's item stays with its owner ("Users manage own
-- personal todos", 20260728000000). The narrower lead policies from 20260818000000 and 20261002000000
-- are now covered by this one and are left in place, harmlessly.
--
-- The app says so where people write their list: the page under the title, and the help text.

DROP POLICY IF EXISTS "Founders and admins read all personal todos" ON public.personal_todos;
CREATE POLICY "Founders and admins read all personal todos"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin')
  );
