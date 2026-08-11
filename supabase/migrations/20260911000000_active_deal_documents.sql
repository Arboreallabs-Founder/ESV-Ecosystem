-- Deal documents: the five links everyone asks for, in one place on the deal.
--
-- They already exist, scattered: "IM Link" and "Term Sheet link" are deal category fields, the rest
-- live in WhatsApp. Category fields are the wrong home for them — they are per-category, so the same
-- link has to be re-entered on a deal tagged both Syndicate and Investment Banking, and there is
-- room for exactly one of each. A deal has several MIS months and more than one version of a deck.
--
-- Note this opens the IM to partners, which 20260905 deliberately did not. That was the right
-- default for an unclassified field; this is an explicit decision to share these five, and each
-- document can still be withheld individually.

CREATE TABLE IF NOT EXISTS public.active_deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,

  -- A fixed set, because the point is that everyone looks in the same place for the same thing.
  -- Free text here would give us "Dataroom", "Data room" and "DataRoom" within a fortnight — the
  -- same drift that made three sector vocabularies.
  kind TEXT NOT NULL CHECK (kind IN ('im', 'financials', 'deck', 'mis', 'dataroom')),

  -- What to call this one, when there is more than one of a kind: "MIS — July", "Deck v3".
  label TEXT,

  -- A link, not an upload. The files already live in Drive where they are edited; copying them here
  -- would mean two versions and no way to tell which is current.
  url TEXT NOT NULL CHECK (url ~* '^https?://'),

  -- Per document rather than per kind: a deal can share its deck and hold back one MIS month.
  -- Defaults true because these five were opened to partners on purpose.
  visible_to_partners BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.active_deal_documents IS
  'IM / financials / deck / MIS / dataroom links on a deal. Links, not uploads — the files stay where they are edited.';

CREATE INDEX IF NOT EXISTS idx_active_deal_documents_deal
  ON public.active_deal_documents(active_deal_id);

ALTER TABLE public.active_deal_documents ENABLE ROW LEVEL SECURITY;

-- ─── Internal ───────────────────────────────────────────────────────────────
-- Founders, admins and associates. Associates work the deals, so making them ask someone to paste
-- a link would mean the links keep living in WhatsApp, which is the thing this replaces.
DROP POLICY IF EXISTS "Internal manage deal documents" ON public.active_deal_documents;
CREATE POLICY "Internal manage deal documents"
  ON public.active_deal_documents FOR ALL TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );

-- `general` reads but does not write: they are on deals without owning them.
DROP POLICY IF EXISTS "General read deal documents" ON public.active_deal_documents;
CREATE POLICY "General read deal documents"
  ON public.active_deal_documents FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'general'
  );

-- ─── Partners ───────────────────────────────────────────────────────────────
-- Read only, and only on a deal that has been opened to them, and only documents not withheld.
-- Three conditions because each answers a different question: is this person a partner, is this
-- deal theirs to see, and is this particular document shared.
DROP POLICY IF EXISTS "Partners read visible deal documents" ON public.active_deal_documents;
CREATE POLICY "Partners read visible deal documents"
  ON public.active_deal_documents FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND visible_to_partners
    AND EXISTS (
      SELECT 1
        FROM public.active_deals d
        JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
        JOIN public.pipelines p        ON p.id = e.pipeline_id
       WHERE d.id = active_deal_id
         AND d.visible_to_partners IS NOT FALSE
         AND p.org_id = public.get_user_org_id()
    )
  );

-- Deliberately no partner INSERT or UPDATE. A partner is a referrer; the documents on a deal are
-- ours to publish, and a link posted by someone outside the team is one nobody has checked.
