-- Meta-tags for companies: themes beyond the primary sector (e.g. a D2C brand that sells via
-- quick-commerce gets a "Quick Commerce" tag). Powers the Suggested Investors panel — matched
-- against each investor's stated thesis sectors to find synergetic (not just sector) fits.
-- Populated by keyword extraction and hand-editable.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS meta_tags TEXT[] NOT NULL DEFAULT '{}';

-- GIN index for tag-overlap queries (future BI / server-side matching).
CREATE INDEX IF NOT EXISTS idx_companies_meta_tags ON public.companies USING GIN (meta_tags);
