-- Phase 2 of HR document generation (see docs/DOCUMENTS_BUILD_PLAN.md).
--
-- Salary lives in its own table, not on `users` or `employee_profiles`. Anything reading those
-- rows would otherwise be reading salary — including joins written months ago by someone who had
-- no idea CTC would end up there. One table, one policy, no accidental leaks.
--
-- EFFECTIVE-DATED, NEVER OVERWRITTEN. An increment inserts a new row; the old one stays. Two
-- things depend on that:
--   * A payslip for March must show what was true in March, not what is true today.
--   * "What was their CTC when they joined" stays answerable.
-- Overwriting would quietly make every historical document unreproducible.

CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The date this package took effect. Together with user_id this identifies a record.
  effective_from    DATE NOT NULL,

  annual_ctc        NUMERIC NOT NULL CHECK (annual_ctc >= 0),

  -- Breakdown. All nullable: a consultant may have a headline figure and nothing else.
  basic             NUMERIC CHECK (basic IS NULL OR basic >= 0),
  hra               NUMERIC CHECK (hra IS NULL OR hra >= 0),
  special_allowance NUMERIC CHECK (special_allowance IS NULL OR special_allowance >= 0),
  employer_pf       NUMERIC CHECK (employer_pf IS NULL OR employer_pf >= 0),
  gratuity          NUMERIC CHECK (gratuity IS NULL OR gratuity >= 0),
  variable_pay      NUMERIC CHECK (variable_pay IS NULL OR variable_pay >= 0),
  other_allowances  NUMERIC CHECK (other_allowances IS NULL OR other_allowances >= 0),

  -- Here so a future overseas hire is a data entry, not a migration.
  currency          TEXT NOT NULL DEFAULT 'INR',

  notes             TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One package per person per start date; a correction updates that row rather than stacking
  -- two records claiming to be in force on the same day.
  UNIQUE (user_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_comp_user
  ON public.employee_compensation(user_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_employee_comp_org ON public.employee_compensation(org_id);

ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

-- Founder/admin/HR only, for every operation.
--
-- Note there is deliberately NO self-read policy. An employee seeing their own compensation row
-- is a feature to design — which fields, how much history, whether variable pay is visible — not
-- a default to back into. Revisit with the employee privacy matrix (see docs/DOCUMENTS.md).
DROP POLICY IF EXISTS "Compensation select" ON public.employee_compensation;
CREATE POLICY "Compensation select" ON public.employee_compensation
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

DROP POLICY IF EXISTS "Compensation insert" ON public.employee_compensation;
CREATE POLICY "Compensation insert" ON public.employee_compensation
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Compensation update" ON public.employee_compensation;
CREATE POLICY "Compensation update" ON public.employee_compensation
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

-- Deleting a compensation record destroys the basis of any payslip already issued against it.
-- Founder only, and the expectation is that mistakes are corrected by editing the row.
DROP POLICY IF EXISTS "Compensation delete" ON public.employee_compensation;
CREATE POLICY "Compensation delete" ON public.employee_compensation
  FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'founder');
