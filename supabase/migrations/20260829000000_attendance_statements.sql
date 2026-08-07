-- Monthly attendance statements: the app version of the sheet HR sends on WhatsApp.
--
-- HR compiles a month per employee, sends it, and the employee approves or disputes it before
-- payroll. Today that whole exchange lives in a chat, which means "I approved it" is unfindable
-- three months later. The point of this table is the audit trail, not the arithmetic.
--
-- ─── The load-bearing decision: a statement is a SNAPSHOT ───────────────────
-- Lines are rows, not a live query over leave_requests. If the statement recomputed itself on
-- every read, a leave approved after the fact would silently change the thing the employee already
-- approved, and the approval would mean nothing. Auto lines are COPIED IN when HR pulls them, and
-- can only be re-pulled while the statement is still editable.

DO $$ BEGIN
  CREATE TYPE attendance_statement_status AS ENUM ('draft', 'sent', 'approved', 'disputed', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- One value per column of the existing sheet, so nothing has to be squeezed into "other".
  CREATE TYPE attendance_line_type AS ENUM (
    'late_login', 'half_day', 'wfh', 'no_punch_out', 'leave',
    'saturday_online', 'saturday_offline', 'saturday_leave',
    'google_form', 'event', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- 'auto' came from the app's own records; 'manual' was typed by HR. Kept apart because the
  -- things the app cannot know — missed punch-outs, late logins, Saturday attendance — have no
  -- source here, and an employee reading the statement deserves to know which is which.
  CREATE TYPE attendance_line_source AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Statements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_statements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  user_id        UUID NOT NULL REFERENCES public.users(id),
  -- Always the first of the month; the CHECK stops a mid-month date creating a second statement
  -- for the same period that would then bypass the UNIQUE below.
  period_month   DATE NOT NULL CHECK (date_trunc('month', period_month) = period_month),

  status         attendance_statement_status NOT NULL DEFAULT 'draft',

  sent_at        TIMESTAMPTZ,
  sent_by        UUID REFERENCES public.users(id),

  approved_at    TIMESTAMPTZ,
  dispute_note   TEXT,
  disputed_at    TIMESTAMPTZ,

  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES public.users(id),
  resolution_note TEXT,

  -- Payroll processed. Approval is required but NOT blocking, so a statement can be locked while
  -- still unapproved — in which case this records that it was, rather than pretending otherwise.
  locked_at      TIMESTAMPTZ,
  locked_by      UUID REFERENCES public.users(id),
  locked_without_approval BOOLEAN NOT NULL DEFAULT false,

  -- The sheet's "deduction of leave/salary" column: a note, not a rupee figure. Payroll does the
  -- arithmetic; putting salary maths on a screen HR and the employee both read is a separate
  -- decision with its own privacy question.
  deduction_note TEXT,

  hr_note        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_att_statements_org_period
  ON public.attendance_statements(org_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_att_statements_user
  ON public.attendance_statements(user_id, period_month DESC);
-- The queue that matters to HR: everything still waiting on an employee.
CREATE INDEX IF NOT EXISTS idx_att_statements_awaiting
  ON public.attendance_statements(org_id, period_month) WHERE status IN ('sent', 'disputed');

DROP TRIGGER IF EXISTS attendance_statements_set_updated_at ON public.attendance_statements;
CREATE TRIGGER attendance_statements_set_updated_at
  BEFORE UPDATE ON public.attendance_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Lines ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_statement_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id),
  statement_id UUID NOT NULL REFERENCES public.attendance_statements(id) ON DELETE CASCADE,

  entry_date   DATE NOT NULL,
  line_type    attendance_line_type NOT NULL,
  source       attendance_line_source NOT NULL DEFAULT 'manual',

  -- Free text for what the sheet writes by hand: "2.00 pm (2nd half)", "PO -1".
  detail       TEXT,

  -- Impact on the month's leave total. 0 for something noted but not charged (a late login), 0.5
  -- for a half day, 1 for a full day. Typed per line rather than inferred from line_type, because
  -- whether two late logins cost half a day is a policy call that changes.
  leave_days   NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (leave_days >= 0 AND leave_days <= 31),

  -- The sheet's "considered": counted on the record, not charged. A waiver needs a reason, so the
  -- decision survives the person who made it.
  waived       BOOLEAN NOT NULL DEFAULT false,
  waived_reason TEXT,
  CHECK (NOT waived OR length(btrim(coalesce(waived_reason, ''))) > 0),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_att_lines_statement
  ON public.attendance_statement_lines(statement_id, entry_date);
-- Re-pulling records replaces auto lines only; this is the lookup that does it.
CREATE INDEX IF NOT EXISTS idx_att_lines_auto
  ON public.attendance_statement_lines(statement_id) WHERE source = 'auto';

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_statement_lines ENABLE ROW LEVEL SECURITY;

-- Who manages statements: the same three roles that already decide leave requests. Reusing that
-- set rather than inventing a third definition of "lead" — attendance and leave are the same
-- kind of decision about the same people.
CREATE OR REPLACE FUNCTION public.is_attendance_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() IN ('founder', 'admin', 'hr');
$$;

-- Read: managers see everything in their org. An employee sees their OWN, but never while it is a
-- draft — an unfinished statement is HR's working copy, and showing half-entered deductions to the
-- person they concern would cause exactly the arguments this feature exists to prevent.
DROP POLICY IF EXISTS "Attendance statements select" ON public.attendance_statements;
CREATE POLICY "Attendance statements select" ON public.attendance_statements
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.is_attendance_manager()
        OR (user_id = auth.uid() AND status <> 'draft')
      )
    )
  );

DROP POLICY IF EXISTS "Attendance statements insert" ON public.attendance_statements;
CREATE POLICY "Attendance statements insert" ON public.attendance_statements
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id() AND public.is_attendance_manager()
  );

-- Update: managers, or the employee acting on their own statement. The employee's allowed
-- transitions (approve / dispute) are enforced in the server action, which can express
-- "sent -> approved" precisely; RLS's job here is just to keep other people out.
DROP POLICY IF EXISTS "Attendance statements update" ON public.attendance_statements;
CREATE POLICY "Attendance statements update" ON public.attendance_statements
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.is_attendance_manager()
        OR (user_id = auth.uid() AND status IN ('sent', 'approved', 'disputed'))
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.is_attendance_manager() OR user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Attendance statements delete" ON public.attendance_statements;
CREATE POLICY "Attendance statements delete" ON public.attendance_statements
  FOR DELETE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.is_attendance_manager()
    -- A locked statement is a payroll record. Deleting it is not a correction, it is erasure.
    AND status <> 'locked'
  );

-- Lines follow their statement exactly: if you can read the statement you can read its lines, and
-- only managers write them.
DROP POLICY IF EXISTS "Attendance lines select" ON public.attendance_statement_lines;
CREATE POLICY "Attendance lines select" ON public.attendance_statement_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_statements s
      WHERE s.id = statement_id
        AND (
          public.is_super_admin()
          OR (
            s.org_id = public.get_user_org_id()
            AND (
              public.is_attendance_manager()
              OR (s.user_id = auth.uid() AND s.status <> 'draft')
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Attendance lines write" ON public.attendance_statement_lines;
CREATE POLICY "Attendance lines write" ON public.attendance_statement_lines
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.is_attendance_manager())
  WITH CHECK (org_id = public.get_user_org_id() AND public.is_attendance_manager());
