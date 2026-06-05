-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: RLS Policies + Auto User Creation Trigger
-- Applied after: 20260526000000_init_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Auto-create public.users record on new auth.users signup ─────────────
-- setupUsers.js only creates auth.users rows; this trigger fills public.users.
-- Default role is 'associate' — update manually in Supabase for founders/admins.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, name)
  VALUES (
    NEW.id,
    NEW.email,
    'associate',
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. Helper: get current user's role (bypasses RLS to avoid recursion) ────

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 3. public.users policies ────────────────────────────────────────────────

CREATE POLICY "Users can view own record"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Founders and admins can view all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin'));

CREATE POLICY "Admins can update user roles"
  ON public.users FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ─── 4. public.deals policies ────────────────────────────────────────────────
-- Column-level note: success_fee_pct and split_pct must be hidden from
-- associates and franchise_partners at the UI layer. PostgreSQL column-level
-- privileges on the `authenticated` role cannot be scoped per user role without
-- views. Implement a `deals_internal_view` in a future migration if stricter
-- column isolation is required before production launch.

-- Founders + admins: full access
CREATE POLICY "Founders and admins full deals access"
  ON public.deals FOR ALL TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin'))
  WITH CHECK (public.get_user_role() IN ('founder', 'admin'));

-- Associates: can view, create, and update all deals (fee fields restricted in UI)
CREATE POLICY "Associates can view all deals"
  ON public.deals FOR SELECT TO authenticated
  USING (public.get_user_role() = 'associate');

CREATE POLICY "Associates can create deals"
  ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'associate');

CREATE POLICY "Associates can update deals"
  ON public.deals FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'associate');

-- Franchise partners: SELECT only deals they referred
CREATE POLICY "Franchise partners see own referred deals"
  ON public.deals FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND referring_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Franchise partners: can insert deals (auto-tagged with their partner_id)
CREATE POLICY "Franchise partners can submit deals"
  ON public.deals FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND referring_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ─── 5. deal_stage_history policies (immutable — no DELETE or UPDATE) ────────

CREATE POLICY "Internal users can view stage history"
  ON public.deal_stage_history FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can insert stage history"
  ON public.deal_stage_history FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

-- No DELETE or UPDATE policies are created — blocked at DB level.

-- ─── 6. deal_notes policies ──────────────────────────────────────────────────

CREATE POLICY "Internal users can view notes"
  ON public.deal_notes FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can create notes"
  ON public.deal_notes FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Authors can update own notes"
  ON public.deal_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ─── 7. deal_documents policies ──────────────────────────────────────────────

CREATE POLICY "Internal users can view documents"
  ON public.deal_documents FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can upload documents"
  ON public.deal_documents FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─── 8. investors policies ───────────────────────────────────────────────────

CREATE POLICY "Internal users can view investors"
  ON public.investors FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can manage investors"
  ON public.investors FOR ALL TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─── 9. fund_outreach policies ───────────────────────────────────────────────

CREATE POLICY "Internal users can manage fund outreach"
  ON public.fund_outreach FOR ALL TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─── 10. franchise_partners policies ─────────────────────────────────────────

CREATE POLICY "Founders and admins manage franchise partners"
  ON public.franchise_partners FOR ALL TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin'))
  WITH CHECK (public.get_user_role() IN ('founder', 'admin'));

CREATE POLICY "Franchise partners can view own record"
  ON public.franchise_partners FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ─── 11. memos policies ──────────────────────────────────────────────────────

CREATE POLICY "Internal users can manage memos"
  ON public.memos FOR ALL TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-MIGRATION MANUAL STEPS (run in Supabase SQL editor):
--
-- 1. Confirm test user emails (bypass email confirmation):
--    UPDATE auth.users SET email_confirmed_at = NOW() WHERE email IN (
--      'founder@earlyseed.vc', 'admin@earlyseed.vc',
--      'associate@earlyseed.vc', 'partner@earlyseed.vc'
--    );
--
-- 2. Set correct roles (the trigger defaults everyone to 'associate'):
--    UPDATE public.users SET role = 'founder' WHERE email = 'founder@earlyseed.vc';
--    UPDATE public.users SET role = 'admin'   WHERE email = 'admin@earlyseed.vc';
--    -- associate@earlyseed.vc already correct
--    UPDATE public.users SET role = 'franchise_partner' WHERE email = 'partner@earlyseed.vc';
--
-- 3. Update display names:
--    UPDATE public.users SET name = 'Monica'   WHERE email = 'founder@earlyseed.vc';
--    UPDATE public.users SET name = 'Siddhant' WHERE email = 'admin@earlyseed.vc';
--    UPDATE public.users SET name = 'Sakshay'  WHERE email = 'associate@earlyseed.vc';
-- ─────────────────────────────────────────────────────────────────────────────
