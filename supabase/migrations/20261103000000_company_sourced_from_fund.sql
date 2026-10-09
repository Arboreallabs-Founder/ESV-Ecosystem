-- Which fund a company came to us from.
--
-- Another fund passing a deal to us is a source worth knowing (and worth thanking), but it is not a
-- fee attribution: no partner is paid for it, so it doesn't go through the claim/approval flow that
-- referred_by_partner_id does. Any internal user can set it, and it's an ordinary column, so the
-- attribution guard (guard_partner_attribution) leaves it alone.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sourced_by_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sourced_by_note TEXT;

COMMENT ON COLUMN public.companies.sourced_by_investor_id IS
  'The fund (an investors row) that introduced this company to ESV. Informational; not a fee attribution.';
COMMENT ON COLUMN public.companies.sourced_by_note IS
  'Optional context for the introduction, e.g. who at the fund sent it and when.';

CREATE INDEX IF NOT EXISTS idx_companies_sourced_by_investor
  ON public.companies(sourced_by_investor_id) WHERE sourced_by_investor_id IS NOT NULL;
