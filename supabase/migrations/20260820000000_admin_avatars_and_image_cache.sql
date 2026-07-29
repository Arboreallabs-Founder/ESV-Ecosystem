-- Admins can set anyone's avatar, and pasted image URLs get mirrored into our own storage.
--
-- Why mirror rather than store the pasted URL:
--   * LinkedIn (and most social CDNs) serve signed, time-limited media URLs. Stored raw, an
--     avatar works today and silently 404s in a few weeks — the classic version of this bug.
--   * Hotlinking depends on the origin's referrer policy, which we don't control and which can
--     change without notice.
--   * Serving from our own public bucket means the browser fetches bytes straight from Supabase's
--     CDN. Nothing transits the Next.js server, so no Vercel bandwidth or image-optimisation
--     quota is involved either way (the app renders avatars with plain <img>, never next/image).
--
-- Objects are written with a long cache-control, so repeat views are served from CDN/browser
-- cache rather than re-fetched.

-- ─── profile-photos: admins may manage any user's avatar ────────────────────
-- The existing "Users manage own profile photo" policy stays as-is (self-service on /settings).
-- This is additive: RLS policies are permissive, so the two OR together.
DROP POLICY IF EXISTS "Admins manage any profile photo" ON storage.objects;
CREATE POLICY "Admins manage any profile photo" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin'))
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin'))
  );

-- ─── cached-images: mirrored third-party images that aren't a user's own ────
-- Company founder headshots and anything else pasted from an external source. Separate bucket
-- from profile-photos so "this is a user's own uploaded photo" stays distinguishable from
-- "this is a copy of someone else's image we fetched", which matters if either ever needs
-- purging or re-fetching independently.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cached-images', 'cached-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read cached images" ON storage.objects;
CREATE POLICY "Public read cached images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'cached-images');

-- Anyone internal who can edit the underlying record can cache an image for it; the record's own
-- RLS is what actually gates whether the edit lands.
DROP POLICY IF EXISTS "Internal write cached images" ON storage.objects;
CREATE POLICY "Internal write cached images" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'cached-images'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr'))
  )
  WITH CHECK (
    bucket_id = 'cached-images'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr'))
  );
