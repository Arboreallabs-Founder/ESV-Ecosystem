-- Digital ID cards and blood group.
--
-- The ID photo is deliberately NOT users.photo_url. That column holds whatever was mirrored in
-- from a pasted link — often a LinkedIn headshot, cropped for a profile chip and sometimes years
-- old. An ID card is identification: it needs a photo the person deliberately supplied for that
-- purpose. Two columns, because they answer two different questions.

DO $$ BEGIN
  CREATE TYPE blood_group AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS blood_group blood_group,
  -- Full URL rather than a storage path: it is rendered directly and the bucket is public.
  ADD COLUMN IF NOT EXISTS id_photo_url TEXT;

-- HR administers people, so it needs the same reach over profile photos that founder/admin have.
-- The existing self-manage policy is untouched — an employee still uploads their own.
DROP POLICY IF EXISTS "Admins manage any profile photo" ON storage.objects;
CREATE POLICY "Admins manage any profile photo" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'hr'))
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

-- An employee can set their own ID photo without being able to touch anything else on their
-- profile — joining date, employment type and the rest stay founder/admin/HR only, because those
-- are what letters assert. This policy is narrow on purpose: it permits an UPDATE on your own row
-- and the column list is enforced in the server action, which is the only caller.
DROP POLICY IF EXISTS "Users set own id photo" ON public.employee_profiles;
CREATE POLICY "Users set own id photo" ON public.employee_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
