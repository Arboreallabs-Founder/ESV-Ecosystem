-- 1. HR gains edit access to Investors and Partners (relationship management sits with HR).
-- 2. Birthday fields for angel investors and partner contacts.
--
-- Birthdays are stored as 'MM-DD' TEXT, not DATE: the year usually isn't known, and a DATE with
-- a sentinel year would be a lie that leaks into sorting and display. TEXT also matches on the
-- same MM-DD slice the existing hr_birthdays lookup uses (src/lib/hr-clock.ts), so "whose
-- birthday is today" stays one comparison everywhere.

-- ─── HR write access ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org internal full investor access" ON public.investors;
CREATE POLICY "Org internal full investor access"
  ON public.investors FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'hr'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'hr'))
  );

DROP POLICY IF EXISTS "Org internal investor_contacts access" ON public.investor_contacts;
CREATE POLICY "Org internal investor_contacts access"
  ON public.investor_contacts FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate', 'hr')
      AND EXISTS (
        SELECT 1 FROM public.investors i
        WHERE i.id = investor_id AND i.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate', 'hr')
      AND EXISTS (
        SELECT 1 FROM public.investors i
        WHERE i.id = investor_id AND i.org_id = public.get_user_org_id()
      )
    )
  );

DROP POLICY IF EXISTS "Org admins manage franchise partners" ON public.franchise_partners;
CREATE POLICY "Org admins manage franchise partners"
  ON public.franchise_partners FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

-- ─── Birthdays ──────────────────────────────────────────────────────────────
-- 'MM-DD', e.g. '07-29'. Nullable: most records won't have one.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS birthday_md TEXT;
ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_birthday_md_format;
ALTER TABLE public.investors
  ADD CONSTRAINT investors_birthday_md_format
  CHECK (birthday_md IS NULL OR birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

ALTER TABLE public.franchise_partners
  ADD COLUMN IF NOT EXISTS contact_birthday_md TEXT;
ALTER TABLE public.franchise_partners
  DROP CONSTRAINT IF EXISTS franchise_partners_birthday_md_format;
ALTER TABLE public.franchise_partners
  ADD CONSTRAINT franchise_partners_birthday_md_format
  CHECK (contact_birthday_md IS NULL OR contact_birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
