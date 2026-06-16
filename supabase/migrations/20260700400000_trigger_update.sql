-- Multi-tenancy Phase 5: update new-user trigger + seed super_admin

-- 1. Update handle_new_user() to read org_id from approved_emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name   TEXT;
  v_role   public.user_role;
  v_org_id UUID;
BEGIN
  SELECT name, role, org_id
  INTO v_name, v_role, v_org_id
  FROM public.approved_emails
  WHERE email = NEW.email;

  -- Not in approved_emails — auth callback will sign them out
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, email, role, name, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'name', v_name, SPLIT_PART(NEW.email, '@', 1)),
    v_org_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Seed platform super_admin (NULL org_id = above all tenants)
INSERT INTO public.approved_emails (email, name, role, org_id)
VALUES ('baligasiddhant@gmail.com', 'Siddhant', 'super_admin', NULL)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', org_id = NULL;

-- Seed sakshay as a regular ESV org founder
INSERT INTO public.approved_emails (email, name, role, org_id)
VALUES ('sakshay@earlyseedventures.com', 'Siddhant', 'founder', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO UPDATE SET role = 'founder', org_id = '00000000-0000-0000-0000-000000000001';

-- 3. Update existing users rows if they exist
UPDATE public.users SET role = 'super_admin', org_id = NULL
WHERE email = 'baligasiddhant@gmail.com';

UPDATE public.users SET role = 'founder', org_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'sakshay@earlyseedventures.com';
