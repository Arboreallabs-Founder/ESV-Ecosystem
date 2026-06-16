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

-- 2. Seed Siddhant's approved_emails entry (NULL org_id = platform-level super_admin)
INSERT INTO public.approved_emails (email, name, role, org_id)
VALUES ('sakshay@earlyseedventures.com', 'Siddhant', 'super_admin', NULL)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', org_id = NULL;

-- 3. Update the existing users row to super_admin with NULL org_id
UPDATE public.users
SET role = 'super_admin', org_id = NULL
WHERE email = 'sakshay@earlyseedventures.com';
