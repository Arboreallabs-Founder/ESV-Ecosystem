-- Widen investors.service_type to allow the new fund types added to the Add Investor
-- form (Debt Fund, Corporate VC Arm, Private Equity, Growth Equity, Fund of Funds,
-- Accelerator/Incubator, Sovereign Wealth Fund, Merchant/Investment Bank).
-- The original CHECK constraint's name isn't tracked in this migration history, so we
-- look it up dynamically rather than assuming a name — safe to re-run.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.investors'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%service_type%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.investors DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.investors ADD CONSTRAINT investors_service_type_check
  CHECK (service_type IN (
    'vc_fund', 'angel_fund', 'family_office', 'angel_investor',
    'debt_fund', 'corporate_vc', 'private_equity', 'growth_equity',
    'fund_of_funds', 'accelerator', 'sovereign_wealth', 'merchant_bank'
  ));
