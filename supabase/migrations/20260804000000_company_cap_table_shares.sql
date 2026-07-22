-- Company-level share structure, so a cap table holder's % can be calculated from their
-- shares instead of typed in by hand. company_cap_table.shares already existed but was
-- never surfaced in the UI — this is the company-wide denominator it needs to be useful.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS total_shares NUMERIC,
  ADD COLUMN IF NOT EXISTS nominal_value_per_share NUMERIC;
