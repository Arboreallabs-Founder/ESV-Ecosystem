-- Phase 1 of HR document generation (see docs/DOCUMENTS_BUILD_PLAN.md).
--
-- Employment data as its own table rather than more columns on `users`. `users` is select('*')-ed
-- in a dozen places, so anything added there starts flowing wherever a user row is read — and a
-- date of birth and home address have no business in a task-board payload. One table, one policy.

DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('full_time', 'intern', 'contract', 'consultant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  user_id                 UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  org_id                  UUID NOT NULL REFERENCES public.organizations(id),

  -- Employment
  employee_code           TEXT,
  date_of_joining         DATE,
  employment_type         employment_type,
  probation_end_date      DATE,
  confirmation_date       DATE,
  reporting_manager_id    UUID REFERENCES public.users(id),
  work_location           TEXT,
  notice_period_days      INTEGER CHECK (notice_period_days IS NULL OR notice_period_days >= 0),
  date_of_exit            DATE,
  exit_reason             TEXT,

  -- Personal. `legal_name` is separate from users.name on purpose: letters have to match the ID
  -- someone presents at a bank, and the display name routinely isn't the name on their PAN.
  legal_name              TEXT,
  date_of_birth           DATE,
  residential_address     TEXT,
  personal_email          TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  updated_by              UUID REFERENCES public.users(id),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique per org, not globally: two orgs may both use ESV-001. Partial so unset codes don't
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS employee_profiles_code_uniq
  ON public.employee_profiles(org_id, employee_code)
  WHERE employee_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_org ON public.employee_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_manager ON public.employee_profiles(reporting_manager_id);

DROP TRIGGER IF EXISTS employee_profiles_set_updated_at ON public.employee_profiles;
CREATE TRIGGER employee_profiles_set_updated_at
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

-- Read: leadership and HR see the org; everyone else sees only their own row.
DROP POLICY IF EXISTS "Employee profiles select" ON public.employee_profiles;
CREATE POLICY "Employee profiles select" ON public.employee_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

-- Write: founder/admin/HR only. Deliberately NOT self-write — an employee editing their own
-- joining date or employment type would be editing the source of their own letters.
DROP POLICY IF EXISTS "Employee profiles insert" ON public.employee_profiles;
CREATE POLICY "Employee profiles insert" ON public.employee_profiles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Employee profiles update" ON public.employee_profiles;
CREATE POLICY "Employee profiles update" ON public.employee_profiles
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Employee profiles delete" ON public.employee_profiles;
CREATE POLICY "Employee profiles delete" ON public.employee_profiles
  FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'));
