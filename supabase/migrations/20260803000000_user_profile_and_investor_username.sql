-- Expanded self-service user profile: designation (exact title, distinct from the `role`
-- permission enum), phone, location, and a photo. Photos live in a public storage bucket
-- (simple public URL, no signed-URL refresh logic needed anywhere they're displayed).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read profile photos" ON storage.objects;
CREATE POLICY "Public read profile photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users manage own profile photo" ON storage.objects;
CREATE POLICY "Users manage own profile photo" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Investor username — auto-generated at creation time, future-proofing for possible
-- investor login/portal access later. Partial unique index: any number of NULLs allowed
-- (covers rows created before this shipped), but set values must be unique.
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS investors_username_uniq ON public.investors (username) WHERE username IS NOT NULL;
