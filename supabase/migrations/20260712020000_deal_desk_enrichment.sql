-- Deal Desk enrichment (Tier 2): add deal-terms + unit-economics fields so cards carry
-- investor-grade signal (round mechanics, margin, burn, runway, customers, total raised).
-- All optional. Tier 1 signals (ARR run-rate, valuation multiple, freshness) are computed
-- at render time and need no columns.

DO $$ BEGIN CREATE TYPE desk_instrument AS ENUM ('Equity','SAFE','Convertible','Other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE desk_round_status AS ENUM ('Open','Closing','Committed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.desk_deals
  ADD COLUMN IF NOT EXISTS business_model    TEXT,
  ADD COLUMN IF NOT EXISTS instrument        desk_instrument,
  ADD COLUMN IF NOT EXISTS round_status      desk_round_status,
  ADD COLUMN IF NOT EXISTS committed_inr     NUMERIC,   -- amount committed in the current round
  ADD COLUMN IF NOT EXISTS total_raised_inr  NUMERIC,   -- total raised to date (prior rounds)
  ADD COLUMN IF NOT EXISTS gross_margin_pct  NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_burn_inr  NUMERIC,
  ADD COLUMN IF NOT EXISTS runway_months     NUMERIC,
  ADD COLUMN IF NOT EXISTS customers_count   NUMERIC;
