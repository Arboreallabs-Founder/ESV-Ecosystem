-- Company Profile / Startup Database (v1)
-- A durable, org-scoped master record per startup — the investor-grade dossier that
-- outlives any single Deal Desk card. Hybrid model: structured core + child tables for
-- funding rounds / cap table / documents / updates, plus an in-app custom-field engine.
-- Deal Desk cards and pipeline entries link to a company via company_id.
-- Internal-only (founder/admin/associate); org-scoped. Documents are URL links in v1.

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE company_status AS ENUM ('prospect','screening','active','portfolio','passed','dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE company_doc_type AS ENUM ('deck','financial_model','cap_table','incorporation','data_room','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE company_field_type AS ENUM ('text','numeric','percentage','url','date');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger helper (reuse if the deal-desk one already exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ── companies (master record) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.organizations(id),
  created_by         UUID REFERENCES public.users(id),
  esv_poc_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Identity / overview
  name               TEXT NOT NULL,
  legal_name         TEXT,
  website            TEXT,
  logo_url           TEXT,
  one_liner          TEXT,
  description        TEXT,
  hq_city            TEXT,
  hq_country         TEXT,
  founded_date       DATE,
  incorporation_type TEXT,
  incorporation_no   TEXT,
  sectors            TEXT[] NOT NULL DEFAULT '{}',
  stage              TEXT,
  business_model     TEXT,
  status             company_status NOT NULL DEFAULT 'prospect',
  tags               TEXT[] NOT NULL DEFAULT '{}',
  -- Product
  product_description TEXT,
  usp                 TEXT,
  tech_stack          TEXT,
  product_links       TEXT[] NOT NULL DEFAULT '{}',
  -- Traction summary (scalar, for at-a-glance + BI)
  arr_inr            NUMERIC,
  mrr_inr            NUMERIC,
  customers_count    NUMERIC,
  team_size          NUMERIC,
  gross_margin_pct   NUMERIC,
  monthly_burn_inr   NUMERIC,
  runway_months      NUMERIC,
  -- Current raise
  ask_inr            NUMERIC,
  instrument         TEXT,
  pre_money_inr      NUMERIC,
  post_money_inr     NUMERIC,
  round_status       TEXT,
  min_ticket_inr     NUMERIC,
  total_raised_inr   NUMERIC,
  use_of_funds       TEXT,
  -- People (read-heavy JSON)
  founders           JSONB NOT NULL DEFAULT '[]',  -- [{name, role, bio, ex_affiliations, linkedin_url, equity_pct}]
  team               JSONB NOT NULL DEFAULT '[]',  -- [{name, role, linkedin_url}]
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_org    ON public.companies(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
-- Case-insensitive name lookups for create-or-link deduplication.
CREATE INDEX IF NOT EXISTS idx_companies_org_lname  ON public.companies(org_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_companies_org_llegal ON public.companies(org_id, lower(legal_name));

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Child tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_funding_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  round_name    TEXT,
  date          DATE,
  amount_inr    NUMERIC,
  valuation_inr NUMERIC,
  instrument    TEXT,
  lead_investor TEXT,
  investors     TEXT[] NOT NULL DEFAULT '{}',
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_funding_rounds_company ON public.company_funding_rounds(company_id);

CREATE TABLE IF NOT EXISTS public.company_cap_table (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  holder_name TEXT NOT NULL,
  holder_type TEXT CHECK (holder_type IN ('founder','investor','esop','other')),
  pct         NUMERIC,
  shares      NUMERIC,
  notes       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_cap_table_company ON public.company_cap_table(company_id);

CREATE TABLE IF NOT EXISTS public.company_documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  label      TEXT NOT NULL,
  doc_type   company_doc_type NOT NULL DEFAULT 'other',
  url        TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON public.company_documents(company_id);

CREATE TABLE IF NOT EXISTS public.company_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  body       TEXT NOT NULL,
  author_id  UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_updates_company ON public.company_updates(company_id);

-- Custom fields (hybrid): org-level definitions + per-company values
CREATE TABLE IF NOT EXISTS public.company_field_defs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  label      TEXT NOT NULL,
  field_type company_field_type NOT NULL DEFAULT 'text',
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_field_defs_org ON public.company_field_defs(org_id);

CREATE TABLE IF NOT EXISTS public.company_field_values (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_def_id  UUID NOT NULL REFERENCES public.company_field_defs(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  value         TEXT,
  UNIQUE (company_id, field_def_id)
);
CREATE INDEX IF NOT EXISTS idx_company_field_values_company ON public.company_field_values(company_id);

-- ── Links from existing deal records ─────────────────────────────────────────
ALTER TABLE public.desk_deals
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_desk_deals_company ON public.desk_deals(company_id);

ALTER TABLE public.pipeline_entries
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_company ON public.pipeline_entries(company_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cap_table      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_updates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_field_defs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_field_values   ENABLE ROW LEVEL SECURITY;

-- companies: internal (founder/admin/associate) full access within org; delete = admin/founder.
DROP POLICY IF EXISTS "Companies select" ON public.companies;
CREATE POLICY "Companies select" ON public.companies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin','associate')));

DROP POLICY IF EXISTS "Companies insert" ON public.companies;
CREATE POLICY "Companies insert" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin','associate'));

DROP POLICY IF EXISTS "Companies update" ON public.companies;
CREATE POLICY "Companies update" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin','associate')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin','associate')));

DROP POLICY IF EXISTS "Companies delete" ON public.companies;
CREATE POLICY "Companies delete" ON public.companies FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin')));

-- Child tables: gate on the parent company being visible in the caller's org.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_funding_rounds','company_cap_table','company_documents','company_updates','company_field_values']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "child all" ON public.%I;', t);
    EXECUTE format($p$
      CREATE POLICY "child all" ON public.%I FOR ALL TO authenticated
      USING (
        public.is_super_admin() OR (
          org_id = public.get_user_org_id()
          AND public.get_user_role() IN ('founder','admin','associate')
          AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.org_id = public.get_user_org_id())
        )
      )
      WITH CHECK (
        org_id = public.get_user_org_id()
        AND public.get_user_role() IN ('founder','admin','associate')
        AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.org_id = public.get_user_org_id())
      );
    $p$, t);
  END LOOP;
END $$;

-- company_field_defs: readable by internal; managed by founder/admin only.
DROP POLICY IF EXISTS "Field defs select" ON public.company_field_defs;
CREATE POLICY "Field defs select" ON public.company_field_defs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin','associate')));

DROP POLICY IF EXISTS "Field defs manage" ON public.company_field_defs;
CREATE POLICY "Field defs manage" ON public.company_field_defs FOR ALL TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin')))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder','admin'));
