-- Work from Home as a tracked category, 24 days a year as the starting standard.
--
-- Run AFTER 20260822000000, which adds the 'wfh' enum value — Postgres rejects a new enum value
-- used in the same transaction that created it.
--
-- 24 is a default, not a rule: like every other entitlement it is editable on the Balances tab
-- (/approvals) by founder/admin/HR, and changing it re-bases everyone's remaining days because
-- remaining is always computed rather than stored.
--
-- Deliberately modelled as an entitlement like the others rather than a separate concept. WFH
-- isn't leave in the HR sense — someone working from home is working — but it is requested,
-- approved and counted against an annual allowance in exactly the same way, so reusing
-- leave_requests keeps one approval queue and one balance calculation instead of a parallel set
-- that would drift.

ALTER TABLE public.leave_policy
  ADD COLUMN IF NOT EXISTS wfh_days NUMERIC NOT NULL DEFAULT 24;

-- Existing orgs were created before this column, so they get the same starting standard rather
-- than a zero that would read as "nobody may work from home".
UPDATE public.leave_policy SET wfh_days = 24 WHERE wfh_days IS NULL;
