-- Investor profiles: fund preferences, POC employment audit, and portfolio.
--
-- Prepares the investors module to receive the 276 funds collated from the ESV workbooks, and to
-- keep being audited afterwards. The fund data is the point: preferences and ticket sizes are
-- already there, but nothing recorded whether a POC still works at the fund — which is what the
-- Fund Completeness Check exists to answer, and what goes stale fastest.

-- ─── Fund preferences ───────────────────────────────────────────────────────

-- What a fund will NOT look at. This is real signal in the source data ("Agnostic - NO meat,
-- alcohol, gambling") and the single most expensive thing to lose: without it, an investor list
-- built for a meat startup includes the fund that wrote "no meat".
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS excluded_sectors TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  CREATE TYPE connect_strength AS ENUM ('warm', 'cold', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only one of the three source sheets carried this, so most funds import as 'unknown' rather than
-- being guessed at — 'cold' would be a claim the data does not make.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS connect_strength connect_strength NOT NULL DEFAULT 'unknown';

-- Stage as a range on a fixed ladder. The source has 106 spellings of six rungs ("Seed to Series
-- A", "Seed - Series A", "Seed to Pre Series A"), which cannot be filtered on as free text.
DO $$ BEGIN
  CREATE TYPE investment_stage AS ENUM
    ('pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'growth');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS stage_min investment_stage,
  ADD COLUMN IF NOT EXISTS stage_max investment_stage,
  -- The original free text is kept: the ladder is an interpretation, and someone should be able
  -- to see what it was interpreted from.
  ADD COLUMN IF NOT EXISTS stage_raw TEXT;

-- Currency for the ticket range. 92 of 245 source cells state a range with no unit at all; those
-- import NULL with the original text in notes, because guessing between USD and INR is an 80x
-- error that would silently poison every ticket-size filter.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS ticket_currency TEXT CHECK (ticket_currency IN ('INR', 'USD'));

-- ESV attribution as names, alongside the existing investor_poc_users foreign keys.
-- Three of the eight people in the sheets have left and have no user record, and they account for
-- 313 of the fund attributions — NB alone owns 165. A foreign key cannot hold that, and dropping
-- it would erase most of the history of who built this database.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS esv_poc_names TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS import_source TEXT;

-- ─── POC employment audit ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE poc_employment_status AS ENUM ('active', 'moved_on', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE poc_rank AS ENUM ('primary', 'secondary', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.investor_contacts
  ADD COLUMN IF NOT EXISTS rank poc_rank NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS employment_status poc_employment_status NOT NULL DEFAULT 'unknown',
  -- Where they went. A POC who moved to another fund is a warm introduction at the new one, so
  -- this is an asset rather than a tombstone.
  ADD COLUMN IF NOT EXISTS new_company TEXT,
  ADD COLUMN IF NOT EXISTS new_designation TEXT,
  ADD COLUMN IF NOT EXISTS audit_note TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  -- Who from our team spoke to them, and how. The user link is for current staff; the name is
  -- always written, so attribution survives someone leaving.
  ADD COLUMN IF NOT EXISTS contacted_by_user_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS contacted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_method TEXT;

-- One primary per investor, enforced rather than hoped for: "who do I call" must have exactly one
-- answer. Secondary is deliberately NOT unique — a fund can have several backups.
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_contacts_one_primary
  ON public.investor_contacts(investor_id) WHERE rank = 'primary';

CREATE INDEX IF NOT EXISTS idx_investor_contacts_employment
  ON public.investor_contacts(investor_id, employment_status);

-- ─── Portfolio ──────────────────────────────────────────────────────────────
-- What an investor has already backed. Names are free text because most of these companies are
-- not in our database, but company_id links the ones that are — and the tags are the point: they
-- are what makes "which funds actually back D2C at seed" answerable.
CREATE TABLE IF NOT EXISTS public.investor_portfolio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  investor_id   UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,

  company_name  TEXT NOT NULL CHECK (length(btrim(company_name)) > 0),
  -- Set when the name matches a company we already track; NULL otherwise. ON DELETE SET NULL, not
  -- CASCADE: deleting our company record must not erase the fact that this fund invested.
  company_id    UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  sector_tags        TEXT[] NOT NULL DEFAULT '{}',
  business_type_tags TEXT[] NOT NULL DEFAULT '{}',

  invested_stage investment_stage,
  invested_year  INT CHECK (invested_year IS NULL OR (invested_year BETWEEN 1980 AND 2100)),
  notes          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.users(id),

  UNIQUE (investor_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_investor_portfolio_investor
  ON public.investor_portfolio(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_portfolio_company
  ON public.investor_portfolio(company_id) WHERE company_id IS NOT NULL;
-- GIN so "which investors back this sector" is an index lookup rather than a scan of every row.
CREATE INDEX IF NOT EXISTS idx_investor_portfolio_sectors
  ON public.investor_portfolio USING GIN (sector_tags);
CREATE INDEX IF NOT EXISTS idx_investor_portfolio_business
  ON public.investor_portfolio USING GIN (business_type_tags);

-- The same lookup on the investors themselves, for list building.
CREATE INDEX IF NOT EXISTS idx_investors_sectors ON public.investors USING GIN (sectors);
CREATE INDEX IF NOT EXISTS idx_investors_excluded ON public.investors USING GIN (excluded_sectors);

ALTER TABLE public.investor_portfolio ENABLE ROW LEVEL SECURITY;

-- Portfolio follows the investors module: internal staff read, founder/admin/associate/hr write.
-- Partners are excluded — this is the proprietary part of the database.
DROP POLICY IF EXISTS "Investor portfolio select" ON public.investor_portfolio;
CREATE POLICY "Investor portfolio select" ON public.investor_portfolio
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    )
  );

DROP POLICY IF EXISTS "Investor portfolio write" ON public.investor_portfolio;
CREATE POLICY "Investor portfolio write" ON public.investor_portfolio
  FOR ALL TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'hr')
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'hr')
  );
