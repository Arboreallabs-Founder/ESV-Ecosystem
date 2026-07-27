-- Narrow the HR clock widget's visibility to founder/admin/hr only — associate and general lose
-- both the top-right widget and the HR-page admin card entirely. This is a genuine narrowing
-- (drop, don't add), unlike every other 'hr' migration so far.

DROP POLICY IF EXISTS "Internal view hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Internal view hr clock settings"
  ON public.hr_clock_settings FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors manage hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Editors manage hr clock settings"
  ON public.hr_clock_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors insert hr clock settings" ON public.hr_clock_settings;
CREATE POLICY "Editors insert hr clock settings"
  ON public.hr_clock_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Internal view hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Internal view hr birthdays"
  ON public.hr_birthdays FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors create hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Editors create hr birthdays"
  ON public.hr_birthdays FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

DROP POLICY IF EXISTS "Editors update hr birthdays" ON public.hr_birthdays;
CREATE POLICY "Editors update hr birthdays"
  ON public.hr_birthdays FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr')));

-- "Admins delete hr birthdays" (founder/admin only) is untouched.
