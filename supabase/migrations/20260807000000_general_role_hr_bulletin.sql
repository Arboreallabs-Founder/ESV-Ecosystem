-- Give the "general" role read access to Bulletin Board and HR Zone (view-only —
-- posting/editing/pinning/deleting stays founder/admin, gated client-side by isAdmin
-- and here by the existing "Admins ..." write policies, which are untouched).
-- Also lets general self-RSVP ("I'm going") to bulletin events, since that button is
-- shown to anyone who can see the post, not just admins.

DROP POLICY IF EXISTS "Internal view bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Internal view bulletin posts"
  ON public.bulletin_posts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));

DROP POLICY IF EXISTS "Internal view hr policies" ON public.hr_policies;
CREATE POLICY "Internal view hr policies"
  ON public.hr_policies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));

DROP POLICY IF EXISTS "Internal view attendees" ON public.bulletin_event_attendees;
CREATE POLICY "Internal view attendees"
  ON public.bulletin_event_attendees FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));

DROP POLICY IF EXISTS "Internal self RSVP" ON public.bulletin_event_attendees;
CREATE POLICY "Internal self RSVP"
  ON public.bulletin_event_attendees FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general') AND user_id = auth.uid());

DROP POLICY IF EXISTS "Internal view event media" ON public.bulletin_event_media;
CREATE POLICY "Internal view event media"
  ON public.bulletin_event_media FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));
