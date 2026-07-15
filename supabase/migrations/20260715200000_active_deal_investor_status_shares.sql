-- Per-investor commitment tracking for the Active Deals investor spreadsheet view.
-- status: a fixed 4-stage progression (not_started -> commitment_received ->
-- funds_received -> shares_transferred), manually advanced.
-- shares: number of shares allocated to this investor for this deal (nullable —
-- not every investor has a share count yet).

ALTER TABLE public.active_deal_investors
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS shares NUMERIC;

DO $$ BEGIN
  ALTER TABLE public.active_deal_investors
    ADD CONSTRAINT active_deal_investors_status_check
    CHECK (status IN ('not_started', 'commitment_received', 'funds_received', 'shares_transferred'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
