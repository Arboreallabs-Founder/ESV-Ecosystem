-- Deal Book: one downloadable PDF of all our deal IMs.
--
--   1. Cover        (your design, uploaded once; today's date stamped on it)
--   2. About Us     (your design, as-is)
--   3. Contents     (your design as the background; the deal list and page numbers stamped on)
--   4. Deal IMs     (one per deal, in the order chosen on /deal-book)
--   5. Back page    (your design, as-is)
--
-- Every page but the cover and back page gets its page number stamped on. Two versions download
-- from the same setup: Named (each deal's IM under the company name) and No-name (each deal's
-- no-name IM, made from the blank template, under its codename).
--
-- Decided 2026-11-23: IMs attach to Active Deals; founders and admins build the book; every
-- internal user can download it.

-- ─── Files ───────────────────────────────────────────────────────────────────
-- Private bucket; paths are `{org_id}/...`. Internal roles read (to download), founder/admin write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-book', 'deal-book', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Deal book objects read" ON storage.objects;
CREATE POLICY "Deal book objects read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-book'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
  );

DROP POLICY IF EXISTS "Deal book objects write" ON storage.objects;
CREATE POLICY "Deal book objects write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deal-book'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
    AND public.get_user_role() IN ('founder', 'admin')
  );

DROP POLICY IF EXISTS "Deal book objects update" ON storage.objects;
CREATE POLICY "Deal book objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deal-book' AND (storage.foldername(name))[1] = public.get_user_org_id()::text
         AND public.get_user_role() IN ('founder', 'admin'))
  WITH CHECK (bucket_id = 'deal-book' AND (storage.foldername(name))[1] = public.get_user_org_id()::text
              AND public.get_user_role() IN ('founder', 'admin'));

DROP POLICY IF EXISTS "Deal book objects delete" ON storage.objects;
CREATE POLICY "Deal book objects delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deal-book' AND (storage.foldername(name))[1] = public.get_user_org_id()::text
         AND public.get_user_role() IN ('founder', 'admin'));

-- ─── Each deal's IM files ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_book_ims (
  active_deal_id UUID PRIMARY KEY REFERENCES public.active_deals(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  named_path     TEXT,    -- the IM under the company's name
  noname_path    TEXT,    -- the no-name IM, made from the blank template
  codename       TEXT,    -- what the no-name book calls it, e.g. "Project Falcon"
  updated_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── The running order ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_book_items (
  active_deal_id UUID PRIMARY KEY REFERENCES public.active_deals(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position       INT NOT NULL DEFAULT 0,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_book_items_order ON public.deal_book_items(org_id, position);

-- ─── The four designed pages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_book_settings (
  org_id        UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  cover_path    TEXT,
  about_path    TEXT,
  contents_path TEXT,
  back_path     TEXT,
  updated_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deal_book_ims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_book_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_book_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['deal_book_ims', 'deal_book_items', 'deal_book_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Internal read %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Internal read %1$s" ON public.%1$I FOR SELECT TO authenticated
      USING (org_id = public.get_user_org_id()
             AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr'))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Leads manage %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Leads manage %1$s" ON public.%1$I FOR ALL TO authenticated
      USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
      WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))$p$, t);
  END LOOP;
END $$;
