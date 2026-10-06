-- Venture Partners: partners who bring us deals and investors, but are not inside the tent.
--
-- An SGP sees every deal on the portal that has not been explicitly hidden (20260828000000). A
-- Venture Partner is further out — they introduce companies and investors, and they see a deal only
-- when someone has put them on it by name.
--
-- ─── Why a tier and not a role ──────────────────────────────────────────────
-- The requirement is "same referral privileges as an SGP, narrower deal visibility". Referral
-- privileges are spread across 68 role checks in the app and a long tail of RLS policies naming
-- 'franchise_partner'; a second enum value would mean widening every one of them to keep the
-- privileges identical, and each one missed is a silent permission hole that looks like a bug
-- months later. The difference here is exactly one mechanism — which deals they see — so that is
-- the only thing that forks. Same reasoning as is_sgp_coordinator being a flag (20260826000000).

ALTER TABLE public.franchise_partners
  ADD COLUMN IF NOT EXISTS partner_tier TEXT NOT NULL DEFAULT 'sgp'
    CONSTRAINT franchise_partners_tier_check CHECK (partner_tier IN ('sgp', 'venture'));

COMMENT ON COLUMN public.franchise_partners.partner_tier IS
  'sgp: sees every portal-visible deal, today''s behaviour. venture: sees only deals they have been explicitly granted on active_deal_partner_access. Referral rights are identical for both.';

-- Default 'sgp' so this migration changes nothing for anyone already on the system. A venture
-- partner is created as one; nobody is demoted by a schema change.

-- ─── Being put on a deal by name ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.active_deal_partner_access (
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,
  partner_id     UUID NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,
  granted_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note           TEXT,
  PRIMARY KEY (active_deal_id, partner_id)
);

COMMENT ON TABLE public.active_deal_partner_access IS
  'Explicit "this partner may see this deal" grants. Only consulted for venture-tier partners; an SGP''s access is governed by active_deals.visible_to_partners.';

CREATE INDEX IF NOT EXISTS idx_adpa_partner ON public.active_deal_partner_access(partner_id);

ALTER TABLE public.active_deal_partner_access ENABLE ROW LEVEL SECURITY;

-- Internal roles manage grants.
DROP POLICY IF EXISTS "Internal manage partner deal access" ON public.active_deal_partner_access;
CREATE POLICY "Internal manage partner deal access"
  ON public.active_deal_partner_access FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.franchise_partners fp
        WHERE fp.id = partner_id AND fp.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.franchise_partners fp
        WHERE fp.id = partner_id AND fp.org_id = public.get_user_org_id()
      )
    )
  );

-- A partner may read their own grants and nobody else's. Read-only: being able to write this table
-- would be being able to grant yourself a deal.
DROP POLICY IF EXISTS "Partners read own deal access" ON public.active_deal_partner_access;
CREATE POLICY "Partners read own deal access"
  ON public.active_deal_partner_access FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND partner_id = (SELECT u.franchise_partner_id FROM public.users u WHERE u.id = auth.uid())
  );

-- ─── The one predicate ──────────────────────────────────────────────────────
-- Every partner-facing read of a deal asks this and nothing else, so the two tiers cannot drift
-- apart across the portal, the summary functions and the entry policy.
--
-- visible_to_partners stays the master switch for both tiers. A grant does not override it: hiding
-- a deal is someone saying "this one does not go outside", and a stale grant quietly surviving that
-- is the failure mode worth avoiding. To show a hidden deal to one venture partner, un-hide it and
-- grant it — two visible acts rather than one invisible interaction.
CREATE OR REPLACE FUNCTION public.partner_can_see_deal(p_deal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.active_deals d
      JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
      JOIN public.pipelines p        ON p.id = e.pipeline_id
      JOIN public.users u            ON u.id = auth.uid()
      JOIN public.franchise_partners fp ON fp.id = u.franchise_partner_id
     WHERE d.id = p_deal_id
       AND u.role = 'franchise_partner'
       AND p.org_id = fp.org_id
       -- Rows predating the column read as visible, matching the column default and the app.
       AND d.visible_to_partners IS NOT FALSE
       AND (
         fp.partner_tier <> 'venture'
         OR EXISTS (
           SELECT 1 FROM public.active_deal_partner_access a
            WHERE a.active_deal_id = d.id AND a.partner_id = fp.id
         )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.partner_can_see_deal(UUID) TO authenticated;

-- ─── The enforcement point, now tier-aware ──────────────────────────────────
-- 20260828000000 established that partners reach active_deals through pipeline_entries, so gating
-- the entry closes the whole path. Same place, same reason; it just asks the fuller question now.
CREATE OR REPLACE FUNCTION public.entry_has_partner_visible_deal(p_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_deals ad
    WHERE ad.pipeline_entry_id = p_entry_id
      AND public.partner_can_see_deal(ad.id)
  );
$$;

-- ─── What is deliberately NOT gated ─────────────────────────────────────────
-- active_deal_partner_shares, exactly as 20260828000000 left it. Money owed to a partner for a deal
-- they brought in must not vanish because the deal stopped being visible to them, and that applies
-- with more force to a venture partner, whose default is to see nothing.
--
-- get_partner_earnings is likewise untouched: it reports on deals a partner is owed against, which
-- is a question about the fee ledger, not about portal visibility. A venture partner who introduced
-- an investor is owed for that whether or not anyone put them on the deal page.
