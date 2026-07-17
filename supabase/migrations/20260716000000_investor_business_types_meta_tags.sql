-- Richer investor thesis tags, mirroring companies.meta_tags: Sector (existing `sectors`)
-- stays as-is; business_types captures the kind of business model an investor favours
-- (e.g. "B2B SaaS", "Marketplace", "D2C"); meta_tags is a catch-all for other thesis
-- themes (e.g. "Quick Commerce", "AI/ML"). Both are bulk-editable via CSV import.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meta_tags      TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_investors_meta_tags ON public.investors USING GIN (meta_tags);
