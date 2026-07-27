-- HR clock widget (Phase 2): India-time clock-in/out reminder windows (per-org, HR-adjustable)
-- and an HR-managed birthday list. Passive display only — no attendance is recorded anywhere.
-- Visibility/edit pattern mirrors hr_policies exactly (20260730000000, 20260812000000):
-- founder/admin/associate/general can SELECT, founder/admin/general can INSERT/UPDATE,
-- only founder/admin can DELETE a birthday (settings has no delete, just update).

CREATE TABLE IF NOT EXISTS public.hr_clock_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL UNIQUE REFERENCES public.organizations(id),
  clock_in_start  TIME NOT NULL DEFAULT '09:30',
  clock_in_end    TIME NOT NULL DEFAULT '10:30',
  clock_out_start TIME NOT NULL DEFAULT '18:30',
  clock_out_end   TIME NOT NULL DEFAULT '19:30',
  updated_by      UUID REFERENCES public.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses the set_updated_at() helper created in 20260713100000_companies.sql.
DROP TRIGGER IF EXISTS hr_clock_settings_set_updated_at ON public.hr_clock_settings;
CREATE TRIGGER hr_clock_settings_set_updated_at
  BEFORE UPDATE ON public.hr_clock_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed a default row for every existing org so there's never a "no row yet" gap in practice.
INSERT INTO public.hr_clock_settings (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.hr_clock_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Internal view hr clock settings"
  ON public.hr_clock_settings FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));

DROP POLICY IF EXISTS "Editors manage hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Editors manage hr clock settings"
  ON public.hr_clock_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Editors insert hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Editors insert hr clock settings"
  ON public.hr_clock_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

-- ─── hr_birthdays ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_birthdays (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  name       TEXT NOT NULL,
  birth_date DATE NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_birthdays_org ON public.hr_birthdays(org_id);

ALTER TABLE public.hr_birthdays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Internal view hr birthdays"
  ON public.hr_birthdays FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general')));

DROP POLICY IF EXISTS "Editors create hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Editors create hr birthdays"
  ON public.hr_birthdays FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Editors update hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Editors update hr birthdays"
  ON public.hr_birthdays FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'general')));

DROP POLICY IF EXISTS "Admins delete hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Admins delete hr birthdays"
  ON public.hr_birthdays FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));
