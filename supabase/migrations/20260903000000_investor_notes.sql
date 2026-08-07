-- Investor notes: the fund's own words about what it looks for.
--
-- 35,000 characters of this were collated from the workbooks and then never written, because there
-- was no column to write them to. That includes the 21 ticket-size ranges whose currency the
-- source never stated, which were supposed to be parked here for review — so those funds currently
-- show a blank ticket size with no trace of what the sheet actually said.
--
-- It is also the thesis: "we will be looking at opportunities that could give us exits within the
-- span of 2 years", "more AI, Health tech or IP backed companies, tech enabled or tech backed",
-- "First cheque of 1.25 cr for 15% future equity". None of that fits a sector tag, and it is the
-- part a person actually reads before deciding whether a fund is worth approaching.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.investors.notes IS
  'Free text from the source sheets: investment thesis, fund size, cheque structure, and any ticket
   size whose currency the source did not state. Searched when ranking thematic matches.';

-- Trigram index so a thesis search is not a sequential scan of every fund's prose. pg_trgm is
-- already available on Supabase; the IF NOT EXISTS keeps this migration re-runnable.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_investors_notes_trgm
  ON public.investors USING GIN (notes gin_trgm_ops);
