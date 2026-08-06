-- Let associates create events.
--
-- The catch: `bulletin_posts` holds both company announcements and events, told apart by
-- `post_type`. Adding 'associate' to the existing policy would have handed associates the
-- company-wide announcement board as well, which nobody asked for and which would not have been
-- visible from the change. So the grant is written against post_type explicitly.
--
-- Editing is narrower than creating. An associate may fix their own event — a wrong date on
-- something you booked is the obvious case — but not rewrite someone else's. Founders, admins and
-- HR keep the existing unrestricted edit. Delete, pin, complete and attendee management stay with
-- founders and admins and are untouched here.

-- ─── INSERT ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins manage bulletin posts" ON public.bulletin_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        -- Associates: events only, and only in their own name.
        OR (
          public.get_user_role() = 'associate'
          AND post_type = 'event'
          AND created_by = auth.uid()
        )
      )
    )
  );

-- ─── UPDATE ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins update bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins update bulletin posts" ON public.bulletin_posts
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        OR (
          public.get_user_role() = 'associate'
          AND post_type = 'event'
          AND created_by = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin', 'hr')
        -- The WITH CHECK matters as much as the USING here: without post_type in it, an associate
        -- could take their own event and turn it into an announcement.
        OR (
          public.get_user_role() = 'associate'
          AND post_type = 'event'
          AND created_by = auth.uid()
        )
      )
    )
  );
