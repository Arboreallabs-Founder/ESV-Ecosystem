-- Angel-investor onboarding/compliance tracking.
-- Shown in the UI only when service_type = 'angel_investor', but kept as plain
-- columns on investors (like the rest of the profile) rather than a child table.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS onboarding_form_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_form_url       TEXT,
  ADD COLUMN IF NOT EXISTS kyc_done                  BOOLEAN NOT NULL DEFAULT false;
