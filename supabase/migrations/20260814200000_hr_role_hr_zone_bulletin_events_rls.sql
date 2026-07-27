-- 'hr' takes over the create/edit (not delete) tier on HR Zone policies, Bulletin, and Events
-- that 'general' currently has at the RLS layer — 'general' is narrowed back to view-only here
-- (DELETE policies, all founder/admin-only already, are untouched throughout).
-- View-tier (SELECT / self-RSVP) policies simply gain 'hr' alongside every existing role.

-- ─── hr_policies ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal view hr policies" ON public.hr_policies;
CREATE POLICY "Internal view hr policies"
  ON public.hr_policies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

DROP POLICY IF EXISTS "Admins create hr policies" ON public.hr_policies;
CREATE POLICY "Admins create hr policies" ON public.hr_policies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Admins update hr policies" ON public.hr_policies;
CREATE POLICY "Admins update hr policies" ON public.hr_policies
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

-- ─── bulletin_posts (covers both announcements and events — same table) ──────
DROP POLICY IF EXISTS "Internal view bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Internal view bulletin posts"
  ON public.bulletin_posts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

DROP POLICY IF EXISTS "Admins manage bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins manage bulletin posts" ON public.bulletin_posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Admins update bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins update bulletin posts" ON public.bulletin_posts
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

-- ─── bulletin_event_attendees / bulletin_event_media ──────────────────────────
DROP POLICY IF EXISTS "Internal view attendees" ON public.bulletin_event_attendees;
CREATE POLICY "Internal view attendees"
  ON public.bulletin_event_attendees FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

DROP POLICY IF EXISTS "Internal self RSVP" ON public.bulletin_event_attendees;
CREATE POLICY "Internal self RSVP"
  ON public.bulletin_event_attendees FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr') AND user_id = auth.uid());

DROP POLICY IF EXISTS "Internal view event media" ON public.bulletin_event_media;
CREATE POLICY "Internal view event media"
  ON public.bulletin_event_media FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

-- ─── Edit-audit logs (append-only, write side follows the editor tier) ────────
DROP POLICY IF EXISTS "Internal write hr policy edit log" ON public.hr_policy_edit_log;
CREATE POLICY "Internal write hr policy edit log" ON public.hr_policy_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Internal write event edit log" ON public.event_edit_log;
CREATE POLICY "Internal write event edit log" ON public.event_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));
