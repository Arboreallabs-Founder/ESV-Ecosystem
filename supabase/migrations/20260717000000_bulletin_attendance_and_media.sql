-- Event attendance ("Going"), a Completed flag, and supporting-media links for Bulletin
-- Board events — together these let us report on who actually showed up to what (the
-- Bulletin KPI page).

ALTER TABLE public.bulletin_posts
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

-- ─── bulletin_event_attendees ("Going") ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulletin_event_attendees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.bulletin_posts(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bulletin_attendees_post ON public.bulletin_event_attendees(post_id);

ALTER TABLE public.bulletin_event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view attendees" ON public.bulletin_event_attendees;
CREATE POLICY "Internal view attendees"
  ON public.bulletin_event_attendees FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

-- Anyone internal can RSVP themselves — never on someone else's behalf.
DROP POLICY IF EXISTS "Internal self RSVP" ON public.bulletin_event_attendees;
CREATE POLICY "Internal self RSVP"
  ON public.bulletin_event_attendees FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate') AND user_id = auth.uid());

-- You can withdraw your own RSVP; admins/founders can remove anyone's (cleanup).
DROP POLICY IF EXISTS "Self or admin remove RSVP" ON public.bulletin_event_attendees;
CREATE POLICY "Self or admin remove RSVP"
  ON public.bulletin_event_attendees FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND (user_id = auth.uid() OR public.get_user_role() IN ('founder', 'admin'))));

-- ─── bulletin_event_media (supporting media links) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.bulletin_event_media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.bulletin_posts(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  label      TEXT,
  url        TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bulletin_media_post ON public.bulletin_event_media(post_id);

ALTER TABLE public.bulletin_event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view event media" ON public.bulletin_event_media;
CREATE POLICY "Internal view event media"
  ON public.bulletin_event_media FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

-- Media links are admin-managed, mirroring who can post/edit bulletin_posts itself.
DROP POLICY IF EXISTS "Admins manage event media" ON public.bulletin_event_media;
CREATE POLICY "Admins manage event media"
  ON public.bulletin_event_media FOR ALL TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'));
