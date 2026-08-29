-- What kind of investor the partner is referring.
--
-- Accepting a referral as a new record has to set investors.service_type, which is NOT NULL, and
-- until now nobody had been asked — so the coordinator picked from a dropdown of twelve, guessing
-- on behalf of somebody who already knew the answer.
--
-- The partner knows. They are referring a person or a fund they have a relationship with, and
-- "corporate VC arm" versus "debt fund" versus "angel investor" is not a judgement call for them.
-- Asking at the point of referral moves the question to the person who can answer it, and leaves
-- the coordinator confirming rather than deciding.
--
-- It matters more than a tidy record: investor lists exclude angel_investor in the database, so a
-- founder's raise plans never reach an angel who might know them personally. A type guessed wrong
-- in that direction defeats a rule the schema goes out of its way to enforce.
ALTER TABLE public.partner_investor_referrals
  ADD COLUMN IF NOT EXISTS service_type TEXT;

COMMENT ON COLUMN public.partner_investor_referrals.service_type IS
  'What the partner says this is. Pre-fills the coordinator''s choice on accept; nullable because referrals made before this existed have none.';

-- Deliberately TEXT with no foreign key to the enum. A referral is a claim from outside the
-- building, and an enum would reject the whole submission for a value we have not thought of yet
-- rather than recording what they said. The value is validated where it is used -- on accept,
-- against SERVICE_TYPE_LABELS -- because that is the moment it becomes a real record.
