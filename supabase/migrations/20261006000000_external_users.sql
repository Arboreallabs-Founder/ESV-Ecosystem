-- External team members: someone onboarded with associate-tier app access (in practice, `general`)
-- who is not an ESV employee — a contractor or seconded person, not on payroll. `is_external` is
-- deliberately orthogonal to `role`: role decides what they can DO in the app, is_external decides
-- whether they show up anywhere the app treats "internal role" as "ESV staff" — the attendance
-- roster, leave/expense requests, and Engage/Kudos. Everything else `general` already grants
-- (read-only deal pipeline, full task access) is untouched.
--
-- Lives on both approved_emails (so it can be set before someone ever logs in, same as role) and
-- users (the value everything else actually reads), mirroring exactly how role/name already work.

ALTER TABLE public.approved_emails ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users           ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

-- handle_new_user() carries is_external across from approved_emails at first sign-in, same as it
-- already does for role/name/org_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name        TEXT;
  v_role        public.user_role;
  v_org_id      UUID;
  v_is_external BOOLEAN;
BEGIN
  SELECT name, role, org_id, is_external
  INTO v_name, v_role, v_org_id, v_is_external
  FROM public.approved_emails
  WHERE email = NEW.email;

  -- Not in approved_emails — auth callback will sign them out
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, email, role, name, org_id, is_external)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'name', v_name, SPLIT_PART(NEW.email, '@', 1)),
    v_org_id,
    COALESCE(v_is_external, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
