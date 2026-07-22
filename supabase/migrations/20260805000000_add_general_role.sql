-- New permission role for non-investment support staff (e.g. a founder's EA): full task
-- access, read-only visibility into deals/companies/investors, no Deal Desk access.
-- Its own migration file — Postgres requires an enum value to be committed before it can be
-- referenced by any policy, so this must apply before the next migration that uses it.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'general';
