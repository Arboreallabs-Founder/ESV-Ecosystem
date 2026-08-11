-- Partner referrals: investors as well as companies, and the tag that puts either on a partner's
-- page. Plus a leak found while building it.
--
-- ─── The leak ───────────────────────────────────────────────────────────────
-- My Companies was showing a partner every entry on the "Imported Deals" pipeline — real ESV deals
-- they had nothing to do with, with the founder's name and email on each. fetchMySubmissions
-- selected pipeline_entries with no filter at all, trusting RLS to scope it, and RLS did not.
--
-- The application-side fix (filter by pipeline and by partner) ships with this. The policy side
-- needs to be seen before it is changed: permissive policies are OR'd, so adding a narrow one can
-- only widen access — the wide one has to be found and removed. rls_policy_audit exists so that is
-- answerable from a query rather than by reading migrations and hoping.

-- ─── Being able to see the policies at all ──────────────────────────────────
-- pg_policies is not reachable through PostgREST, so "what can a partner actually read" has been
-- unanswerable without opening the SQL editor. Granted to service_role only, which already
-- bypasses RLS entirely — it gives away nothing it does not already have.
CREATE OR REPLACE VIEW public.rls_policy_audit AS
  SELECT schemaname, tablename, policyname, permissive, roles::TEXT AS roles, cmd, qual, with_check
    FROM pg_policies
   WHERE schemaname = 'public';

REVOKE ALL ON public.rls_policy_audit FROM anon, authenticated;
GRANT SELECT ON public.rls_policy_audit TO service_role;

-- ─── Companies referred by a partner ────────────────────────────────────────
-- The other half of "my companies". A partner submits some directly, and for the rest we already
-- had the company on file when they introduced it — same as the investor case, and for the same
-- reason: re-entering it would be a duplicate record and a second claim on one relationship.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID
    REFERENCES public.franchise_partners(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.companies.referred_by_partner_id IS
  'The partner who introduced this company. Set by an admin or SGP coordinator; puts the company on that partner''s My Companies.';

CREATE INDEX IF NOT EXISTS idx_companies_referred_by_partner
  ON public.companies(referred_by_partner_id) WHERE referred_by_partner_id IS NOT NULL;

-- A partner reads the companies tagged to them, and nothing else in the company database.
DROP POLICY IF EXISTS "Partners read own referred companies" ON public.companies;
CREATE POLICY "Partners read own referred companies"
  ON public.companies FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND referred_by_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ─── Investor referrals ─────────────────────────────────────────────────────
-- Partners cannot create investors (20260905): a partner adding a fund we already hold makes a
-- duplicate record and a fee-split claim over a relationship that was already ours. But "tell us
-- and we will tag it" was a WhatsApp message with nothing tracking it. This is that conversation,
-- with a queue and an outcome.
--
-- Deliberately not a row in `investors`. A referral is a claim about a relationship, not a fund
-- record, and it must not enter the database anyone searches until someone has checked whether we
-- already hold it.
CREATE TABLE IF NOT EXISTS public.partner_investor_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- What the partner knows. Only the name is required: the point is to capture the introduction
  -- while it is in front of them, and a form that demands a website loses the referral.
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  notes TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  -- Set on accept. Either the fund we already held, or the one created from this referral — the
  -- coordinator decides which, and the answer is recorded either way.
  investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  -- Required on reject by the action, not by the table: "no" without a reason is the thing that
  -- makes a partner stop referring.
  decision_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_investor_referrals_partner
  ON public.partner_investor_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_investor_referrals_pending
  ON public.partner_investor_referrals(org_id) WHERE status = 'pending';

ALTER TABLE public.partner_investor_referrals ENABLE ROW LEVEL SECURITY;

-- A partner refers, on their own behalf, and reads back only their own.
DROP POLICY IF EXISTS "Partners submit investor referrals" ON public.partner_investor_referrals;
CREATE POLICY "Partners submit investor referrals"
  ON public.partner_investor_referrals FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND submitted_by = auth.uid()
    AND partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
    -- A partner cannot arrive pre-approved, and cannot attach an investor id.
    AND status = 'pending'
    AND investor_id IS NULL
  );

DROP POLICY IF EXISTS "Partners read own investor referrals" ON public.partner_investor_referrals;
CREATE POLICY "Partners read own investor referrals"
  ON public.partner_investor_referrals FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  );

-- Deliberately no partner UPDATE or DELETE. Withdrawing a referral after we have acted on it
-- rewrites who introduced whom, which is the one fact this table exists to hold.

-- The queue side: whoever triages the SGP desk reads and decides.
DROP POLICY IF EXISTS "Coordinators read investor referrals" ON public.partner_investor_referrals;
CREATE POLICY "Coordinators read investor referrals"
  ON public.partner_investor_referrals FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND (
      public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_coordinator)
    )
  );

DROP POLICY IF EXISTS "Coordinators decide investor referrals" ON public.partner_investor_referrals;
CREATE POLICY "Coordinators decide investor referrals"
  ON public.partner_investor_referrals FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND (
      public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_coordinator)
    )
  );

-- ─── The same projection, for the whole list ────────────────────────────────
-- 20260909 fixed one deal at a time. The Active Deals *list* has the identical problem for the
-- identical reason: every card showed a coloured initial instead of the company's mark and
-- "Unassigned" instead of the person who owns it, because the logo lives on `companies` and the
-- assignees are read through `users`. Neither is readable by a partner.
--
-- Also widened: the ESV contact now carries email, phone and designation. A partner being told who
-- their point of contact is, with no way to reach them, is a name — not a contact. This is work
-- contact information for the person handling their deal, which is the whole reason it is shown.
CREATE OR REPLACE FUNCTION public.get_partner_deal_summary(p_deal_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logo_url',         COALESCE(d.logo_url, c.logo_url),
    'company_name',     c.name,
    'committed_total',  COALESCE(agg.total, 0),
    'commitment_count', COALESCE(agg.n, 0),
    'assignees',        COALESCE(ass.list, '[]'::jsonb)
  )
  FROM public.active_deals d
  JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
  JOIN public.pipelines p        ON p.id = e.pipeline_id
  LEFT JOIN public.companies c   ON c.id = e.company_id
  LEFT JOIN LATERAL (
    SELECT SUM(i.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors i
     WHERE i.active_deal_id = d.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'user_id', a.user_id, 'name', u.name, 'photo_url', u.photo_url,
               'designation', u.designation, 'email', u.email, 'phone', u.phone
             ) ORDER BY u.name
           ) AS list
      FROM public.pipeline_entry_assignees a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.entry_id = e.id
  ) ass ON TRUE
  WHERE d.id = p_deal_id
    AND public.get_user_role() = 'franchise_partner'
    AND p.org_id = public.get_user_org_id()
    AND d.visible_to_partners IS NOT FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_summary(UUID) TO authenticated;

-- One call for the list, keyed by deal id, rather than one per card.
CREATE OR REPLACE FUNCTION public.get_partner_deal_summaries()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(d.id, jsonb_build_object(
    'logo_url',         COALESCE(d.logo_url, c.logo_url),
    'company_name',     c.name,
    'committed_total',  COALESCE(agg.total, 0),
    'commitment_count', COALESCE(agg.n, 0),
    'assignees',        COALESCE(ass.list, '[]'::jsonb)
  )), '{}'::jsonb)
  FROM public.active_deals d
  JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
  JOIN public.pipelines p        ON p.id = e.pipeline_id
  LEFT JOIN public.companies c   ON c.id = e.company_id
  LEFT JOIN LATERAL (
    SELECT SUM(i.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors i
     WHERE i.active_deal_id = d.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'user_id', a.user_id, 'name', u.name, 'photo_url', u.photo_url,
               'designation', u.designation, 'email', u.email, 'phone', u.phone
             ) ORDER BY u.name
           ) AS list
      FROM public.pipeline_entry_assignees a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.entry_id = e.id
  ) ass ON TRUE
  WHERE public.get_user_role() = 'franchise_partner'
    AND p.org_id = public.get_user_org_id()
    AND d.visible_to_partners IS NOT FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_summaries() TO authenticated;
