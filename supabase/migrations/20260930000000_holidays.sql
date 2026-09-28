-- The company holiday calendar, as data.
--
-- Until now the 2026 holiday list existed only as a table inside the Leave Policy's prose. That
-- makes it unreadable to code, and the cost is a live bug: requestDays() in lib/leave-balances.ts
-- counts calendar days inclusive, so a Friday-to-Monday leave is charged 4 days including the
-- Sunday, and a leave spanning Diwali is charged for Diwali. That number flows into the monthly
-- attendance statement and from there into a salary deduction.
--
-- One row per non-working day. Sundays are NOT rows — the weekly off is a rule, not a calendar
-- entry, and seeding 52 Sundays a year would be a list nobody could maintain. Code skips Sunday
-- and then skips anything in here.
--
-- `kind` separates the published list from anything added mid-year:
--   'public'  — the festival/national holiday list, circulated at the start of the calendar year.
--   'company' — a closure declared later, which the policy explicitly anticipates ("any other
--               mandatory leaves/holidays as & when declared by the State or Central Government").
--
-- The Special Holiday Week is deliberately NOT in here. The policy grants 5 days of paid leave to
-- be taken within 15 Dec - 5 Jan; it is an entitlement with its own lapse rule, not a company-wide
-- closure of that window. Putting it on the calendar would mark three weeks as non-working for
-- everyone and quietly stop charging leave taken in them.

CREATE TABLE IF NOT EXISTS public.holidays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id),
  holiday_date DATE NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'public' CHECK (kind IN ('public', 'company')),
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One entry per day per org: two rows for the same date would double-count a day off.
  UNIQUE (org_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON public.holidays(org_id, holiday_date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Everyone internal reads. This is the one HR table that is not admin-only: an associate filling
-- in a leave request needs to know which days are holidays, and the form shows the working-day
-- count as they pick dates. Franchise partners are excluded — they are not on this calendar.
DROP POLICY IF EXISTS "Internal view holidays" ON public.holidays;
CREATE POLICY "Internal view holidays"
  ON public.holidays FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

-- Same write tier as hr_birthdays and hr_clock_settings: this is HR calendar config.
DROP POLICY IF EXISTS "Editors create holidays" ON public.holidays;
CREATE POLICY "Editors create holidays"
  ON public.holidays FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors update holidays" ON public.holidays;
CREATE POLICY "Editors update holidays"
  ON public.holidays FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors delete holidays" ON public.holidays;
CREATE POLICY "Editors delete holidays"
  ON public.holidays FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

-- ─── 2026 calendar ──────────────────────────────────────────────────────────
-- Transcribed from the Leave Policy's own annexed list (see
-- 20260929000000_attendance_and_leave_policies.sql). Two things to know about it:
--
--   * The policy's §7 prose says 12 holidays and its table lists 15. The list is what HR published,
--     so the list is what is seeded. The prose is flagged for HR to correct.
--   * 15-08-2026 (Independence Day) falls on a Saturday. It is still a row: Saturday is a working
--     day here, so a holiday on one is a real day off and must not be charged as leave.
--   * The policy's final row named the occasion "Friday" (the day, duplicated into the occasion
--     column). Seeded as Christmas, which 25-12 is. Worth HR confirming.
--
-- ON CONFLICT DO NOTHING so this is safe to re-run and cannot clobber an edit HR has since made.
INSERT INTO public.holidays (org_id, holiday_date, name, kind) VALUES
  ('00000000-0000-0000-0000-000000000001', '2026-01-01', 'New Year',                'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-01-26', 'Republic Day',            'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-03-04', 'Holi',                    'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-05-01', 'Maharashtra Day',         'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-08-15', 'Independence Day',        'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-08-28', 'Raksha Bandhan',          'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-09-04', 'Janmashtami',             'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-09-14', 'Ganesh Chaturthi',        'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-09-25', 'Ganpati Visarjan',        'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-10-02', 'Gandhi Jayanti',          'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-10-20', 'Dussera',                 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-11-09', 'Diwali - Govardhan Puja', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-11-10', 'Hindu New Year',          'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-11-11', 'Bhai Dooj',               'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-12-25', 'Christmas',               'public')
ON CONFLICT (org_id, holiday_date) DO NOTHING;
