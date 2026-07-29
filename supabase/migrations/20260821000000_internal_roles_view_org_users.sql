-- HR and general could not read the `users` table at all beyond their own row.
--
-- Symptom: every embedded person join came back NULL, so /approvals showed leave and expense
-- requests from "Unknown", the balances roster was empty of names, and avatars fell back to
-- initials of nothing. The requests themselves were readable — only the requester's name wasn't.
--
-- Cause: the SELECT policies on users were self, founder/admin, and (since 20260809000000)
-- associate. `general` and `hr` were added to the app later and never picked up here, which is
-- easy to miss because nothing errors: RLS filters the joined row out silently and the UI just
-- renders its fallback.
--
-- These are internal colleagues who see each other's names on tasks, events, kudos and the
-- bulletin already. This replaces the associate-only policy with one covering every internal
-- role rather than stacking a fourth overlapping policy on the table.

DROP POLICY IF EXISTS "Associates view org users" ON public.users;
DROP POLICY IF EXISTS "Internal roles view org users" ON public.users;

CREATE POLICY "Internal roles view org users" ON public.users
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
  );

-- Untouched and still in force alongside this (policies are permissive, so they OR together):
--   "Users view own record"     — id = auth.uid()
--   "Org admins view org users" — founder/admin, plus super_admin across orgs
