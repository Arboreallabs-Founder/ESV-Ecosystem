-- Our own vehicles are not investors to approach.
--
-- ESV Advisors LLP sits on FWDA's cap table and is in the investors table because that is where a
-- cap table line has to live. But it is ESV's own syndicate vehicle, not a fund anyone pitches, and
-- filing it as a family office put it in the list people work: it appeared among funds to approach,
-- and it was flagged "No POC at all" and queued for a point-of-contact hunt — for a vehicle whose
-- point of contact is us.
--
-- `internal_vehicle` says what it is. The same will be true of any SPV or LLP we set up to hold a
-- syndicate, and there will be more of them.
--
-- ─── POC ────────────────────────────────────────────────────────────────────
-- Exempt, for the same reason angel_investor already is: an angel is their own contact, and an
-- internal vehicle's contact is the person reading the screen. The app expressed that exemption as
-- a bare `service_type !== 'angel_investor'` in four separate places; it is a `needsPoc()` helper
-- now, so the second exemption did not become a second literal in four files and a third would not
-- become a third.

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
    'fund_of_funds', 'accelerator', 'sovereign_wealth', 'merchant_bank',
    'internal_vehicle'
  ));

-- ESV Advisors LLP, the one that prompted this. Matched by name within the org rather than by id,
-- since the row was created by the FWDA import and its id is not knowable from here.
UPDATE public.investors
   SET service_type = 'internal_vehicle'
 WHERE name = 'ESV Advisors LLP';

-- Any POC hunt already raised against an internal vehicle is pointless. Cleared rather than left to
-- sit in somebody's queue; the task itself is left alone, since deleting work someone may have
-- started is a bigger call than un-pointing at it.
UPDATE public.investors
   SET poc_search_task_id = NULL, poc_search_started_at = NULL
 WHERE service_type = 'internal_vehicle'
   AND poc_search_task_id IS NOT NULL;
