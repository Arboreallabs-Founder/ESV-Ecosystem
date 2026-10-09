-- Fix: every company insert and update failed with 42703 (undefined_column).
--
-- 20261018000000 extended guard_partner_attribution(), which runs on BOTH investors and companies,
-- with:
--     IF TG_TABLE_NAME = 'investors' AND NEW.referred_by_investor_id IS NOT NULL THEN
-- PL/pgSQL does not short-circuit that into skipping the second half: it resolves
-- NEW.referred_by_investor_id on a companies row, which has no such column, and raises
-- "record new has no field referred_by_investor_id" (SQLSTATE 42703). So since that migration ran,
-- creating a company, editing a company profile, accepting a deal (which creates/links one) and
-- filling a profile from an application all failed.
--
-- Same function, same rules; the investor-only check is nested inside the table test so the
-- column is only ever touched on an investors row.

CREATE OR REPLACE FUNCTION public.guard_partner_attribution() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.applying_attribution', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.referred_by_partner_id IS NOT NULL THEN
      RAISE EXCEPTION 'A partner attribution cannot be set at creation. Create the record, then file a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Nested, not AND-ed: companies has no referred_by_investor_id, and PL/pgSQL would still
    -- resolve the column in a combined condition.
    IF TG_TABLE_NAME = 'investors' THEN
      IF NEW.referred_by_investor_id IS NOT NULL THEN
        RAISE EXCEPTION 'An investor cannot be created already placed under another investor. Create the record, then file a claim on the SGP Desk.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  ELSE
    IF NEW.referred_by_partner_id IS DISTINCT FROM OLD.referred_by_partner_id THEN
      RAISE EXCEPTION 'Partner attribution is set by approval, not directly. File a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF TG_TABLE_NAME = 'investors' THEN
      IF NEW.referred_by_investor_id IS DISTINCT FROM OLD.referred_by_investor_id THEN
        RAISE EXCEPTION 'Who introduced an investor is set by approval, not directly. File a claim on the SGP Desk.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;
