-- Let founders/admins log attendance on someone else's behalf (e.g. backfilling a past
-- event where people didn't RSVP through the app). The existing "Internal self RSVP"
-- policy stays untouched (self-only for associate/general); this is a purely additive
-- policy that only widens what founder/admin can do.
-- (Removing someone else's RSVP is already covered by "Self or admin remove RSVP".)
DROP POLICY IF EXISTS "Admins add any attendee" ON public.bulletin_event_attendees;
CREATE POLICY "Admins add any attendee" ON public.bulletin_event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'));
