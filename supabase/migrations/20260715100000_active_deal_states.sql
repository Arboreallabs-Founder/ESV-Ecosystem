-- Active-deal lifecycle states.
-- A manual, flat state per active deal:
--   active   — currently being worked
--   dormant  — paused / stalled
--   closed   — concluded
--   archived — hidden from the default Active Deals view
-- Users set this manually via a dropdown; nothing changes it automatically.

ALTER TABLE public.active_deals
  ADD COLUMN IF NOT EXISTS deal_state TEXT NOT NULL DEFAULT 'active';

-- Constrain to the four known states (idempotent — skip if already present).
DO $$ BEGIN
  ALTER TABLE public.active_deals
    ADD CONSTRAINT active_deals_deal_state_check
    CHECK (deal_state IN ('active', 'dormant', 'closed', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_active_deals_deal_state ON public.active_deals(deal_state);
