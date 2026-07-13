-- Deal Desk: two fields added in-app after import (not part of the CSV):
--   analyst_opinion — the authoring analyst's short take (hard ≤100 char limit)
--   referrer        — who referred / sourced the deal
-- referrer is indexed so it can be grouped/filtered efficiently for later BI/reporting.

ALTER TABLE public.desk_deals
  ADD COLUMN IF NOT EXISTS analyst_opinion TEXT
    CHECK (analyst_opinion IS NULL OR char_length(analyst_opinion) <= 100),
  ADD COLUMN IF NOT EXISTS referrer TEXT;

CREATE INDEX IF NOT EXISTS idx_desk_deals_referrer ON public.desk_deals(referrer);
