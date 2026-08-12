-- A poster on the event card.
--
-- The two link fields events already carry (media_url, scanned_cards_url) are Google Drive/Photos
-- URLs. Those cannot be rendered: a Drive "…/view?usp=sharing" link serves an HTML viewer page, not
-- an image, so pointing an <img> at one shows a broken icon. The poster is therefore an uploaded
-- file in our own bucket rather than another pasted link — the same choice profile photos made.
--
-- Public bucket, because the poster is displayed inline on a list of cards. A private bucket would
-- mean minting a signed URL per event per page load and refreshing them before they expire, to
-- protect an image whose whole purpose is being circulated.

ALTER TABLE public.bulletin_posts
  ADD COLUMN IF NOT EXISTS poster_url TEXT;

COMMENT ON COLUMN public.bulletin_posts.poster_url IS
  'Uploaded poster/invite image, shown on the event card face and full-size when opened.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Object paths are `{org_id}/{uuid}.{ext}`.
DROP POLICY IF EXISTS "Public read event posters" ON storage.objects;
CREATE POLICY "Public read event posters" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'event-posters');

-- Write is limited to the roles that may create or edit an event at all (see requireEditor in
-- src/app/actions/events.ts). An associate's ownership limit is enforced on the row, not here:
-- storage has no idea which event an object is destined for, and the poster is only reachable once
-- a bulletin_posts update they are allowed to make points at it.
DROP POLICY IF EXISTS "Editors write event posters" ON storage.objects;
CREATE POLICY "Editors write event posters" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin', 'hr', 'associate')
  );

DROP POLICY IF EXISTS "Editors update event posters" ON storage.objects;
CREATE POLICY "Editors update event posters" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin', 'hr', 'associate')
  )
  WITH CHECK (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin', 'hr', 'associate')
  );

DROP POLICY IF EXISTS "Editors delete event posters" ON storage.objects;
CREATE POLICY "Editors delete event posters" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin', 'hr', 'associate')
  );
