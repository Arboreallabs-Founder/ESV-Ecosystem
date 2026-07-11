-- Deal Desk module: associates submit condensed post-call deal summaries (via CSV import),
-- founders/admins (the MD) review them as a phone-friendly card feed and act on each card
-- (reject / discuss-in-person / need-more-info). Actions route back to the authoring associate.
--
-- Tables are namespaced `desk_*` to avoid collision with the legacy `deals` table.
-- Standalone module — not wired into pipelines/active_deals (promote-later hook lives in the app).

-- ── Enums ───────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE desk_stage AS ENUM ('MVP','Pre-Seed','Seed','Pre-Series A','Series A','Series A+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_valuation_type AS ENUM ('Fixed','TBD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_revenue_status AS ENUM ('Yes','Negligible','No');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_revenue_period AS ENUM ('Monthly','Annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_deal_status AS ENUM ('open','rejected','discuss','more_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_action_type AS ENUM ('reject','discuss_in_person','need_more_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── updated_at trigger helper (module-local; no shared one exists) ────────────────
CREATE OR REPLACE FUNCTION public.desk_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── desk_deals ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.desk_deals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES public.organizations(id),
  associate_id              UUID NOT NULL REFERENCES public.users(id),
  company_name              TEXT NOT NULL CHECK (char_length(company_name) <= 40),
  sector                    TEXT,
  about                     TEXT CHECK (about IS NULL OR char_length(about) <= 50),
  location                  TEXT CHECK (location IS NULL OR char_length(location) <= 50),
  stage                     desk_stage,
  ask_inr                   NUMERIC,
  valuation_type            desk_valuation_type,
  valuation_inr             NUMERIC,
  dilution_percent          NUMERIC,
  cap_table_notable_names   TEXT[] NOT NULL DEFAULT '{}',
  cap_table_structure_notes TEXT,
  revenue_status            desk_revenue_status,
  revenue_period            desk_revenue_period,
  revenue_data              JSONB NOT NULL DEFAULT '[]',   -- [{ period, amount }]
  usp                       TEXT,
  founders                  JSONB NOT NULL DEFAULT '[]',   -- [{ name, affiliation, bio, linkedin_url }]
  pitch_deck_url            TEXT,
  notes                     TEXT,
  call_date                 DATE,
  seen_status               BOOLEAN NOT NULL DEFAULT FALSE, -- false = unseen by the MD
  starred                   BOOLEAN NOT NULL DEFAULT FALSE,
  deal_status               desk_deal_status NOT NULL DEFAULT 'open',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desk_deals_org           ON public.desk_deals(org_id);
CREATE INDEX IF NOT EXISTS idx_desk_deals_associate     ON public.desk_deals(associate_id);
CREATE INDEX IF NOT EXISTS idx_desk_deals_assoc_seen    ON public.desk_deals(associate_id, seen_status);

DROP TRIGGER IF EXISTS trg_desk_deals_updated_at ON public.desk_deals;
CREATE TRIGGER trg_desk_deals_updated_at
  BEFORE UPDATE ON public.desk_deals
  FOR EACH ROW EXECUTE FUNCTION public.desk_set_updated_at();

-- ── desk_deal_media (gallery — populated by in-app upload, never via CSV) ─────────
CREATE TABLE IF NOT EXISTS public.desk_deal_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES public.desk_deals(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  url         TEXT NOT NULL,   -- storage object path within the `deal-desk` bucket
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desk_deal_media_deal ON public.desk_deal_media(deal_id);

-- ── desk_deal_actions (MD action / audit trail routed back to the author) ─────────
CREATE TABLE IF NOT EXISTS public.desk_deal_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        UUID NOT NULL REFERENCES public.desk_deals(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  action_type    desk_action_type NOT NULL,
  comment_text   TEXT,
  voice_note_url TEXT,   -- storage object path within the `deal-desk` bucket
  created_by     UUID NOT NULL REFERENCES public.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desk_deal_actions_deal ON public.desk_deal_actions(deal_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.desk_deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_deal_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_deal_actions ENABLE ROW LEVEL SECURITY;

-- desk_deals: reviewers (founder/admin) see all in-org; associates see only their own.
DROP POLICY IF EXISTS "Desk deals select" ON public.desk_deals;
CREATE POLICY "Desk deals select" ON public.desk_deals
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder','admin') OR associate_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Desk deals insert" ON public.desk_deals;
CREATE POLICY "Desk deals insert" ON public.desk_deals
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'associate'
    AND associate_id = auth.uid()
  );

DROP POLICY IF EXISTS "Desk deals update" ON public.desk_deals;
CREATE POLICY "Desk deals update" ON public.desk_deals
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder','admin') OR associate_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder','admin') OR associate_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Desk deals delete" ON public.desk_deals;
CREATE POLICY "Desk deals delete" ON public.desk_deals
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder','admin') OR associate_id = auth.uid())
    )
  );

-- Shared visibility predicate for child rows: caller can see the parent deal.
-- desk_deal_media: follows parent visibility for select; author manages their own deal's gallery.
DROP POLICY IF EXISTS "Desk media select" ON public.desk_deal_media;
CREATE POLICY "Desk media select" ON public.desk_deal_media
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.desk_deals d
      WHERE d.id = deal_id AND d.org_id = public.get_user_org_id()
        AND (public.get_user_role() IN ('founder','admin') OR d.associate_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Desk media write" ON public.desk_deal_media;
CREATE POLICY "Desk media write" ON public.desk_deal_media
  FOR ALL TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND EXISTS (SELECT 1 FROM public.desk_deals d WHERE d.id = deal_id AND d.associate_id = auth.uid())
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND EXISTS (SELECT 1 FROM public.desk_deals d WHERE d.id = deal_id AND d.associate_id = auth.uid())
  );

-- desk_deal_actions: visible to anyone who can see the parent deal (author sees MD feedback here).
DROP POLICY IF EXISTS "Desk actions select" ON public.desk_deal_actions;
CREATE POLICY "Desk actions select" ON public.desk_deal_actions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.desk_deals d
      WHERE d.id = deal_id AND d.org_id = public.get_user_org_id()
        AND (public.get_user_role() IN ('founder','admin') OR d.associate_id = auth.uid())
    )
  );

-- Only reviewers (founder/admin) create actions, and only on in-org deals.
DROP POLICY IF EXISTS "Desk actions insert" ON public.desk_deal_actions;
CREATE POLICY "Desk actions insert" ON public.desk_deal_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder','admin')
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.desk_deals d WHERE d.id = deal_id AND d.org_id = public.get_user_org_id())
  );

-- ── Storage: private `deal-desk` bucket, org-prefixed object paths ────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-desk', 'deal-desk', false)
ON CONFLICT (id) DO NOTHING;

-- Object paths are `{org_id}/gallery/{deal_id}/…` and `{org_id}/voice/{deal_id}/…`.
-- Gate every operation on the first path segment matching the caller's org.
DROP POLICY IF EXISTS "Deal desk objects select" ON storage.objects;
CREATE POLICY "Deal desk objects select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deal-desk' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Deal desk objects insert" ON storage.objects;
CREATE POLICY "Deal desk objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-desk' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Deal desk objects update" ON storage.objects;
CREATE POLICY "Deal desk objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deal-desk' AND (storage.foldername(name))[1] = public.get_user_org_id()::text)
  WITH CHECK (bucket_id = 'deal-desk' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Deal desk objects delete" ON storage.objects;
CREATE POLICY "Deal desk objects delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deal-desk' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
