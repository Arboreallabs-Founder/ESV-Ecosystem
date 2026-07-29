-- Optional birth year alongside the existing MM-DD birthday.
--
-- Deliberately a separate nullable column rather than converting birthday_md to a DATE: the
-- reason DD/MM was chosen in 20260817000000 hasn't gone away — for most angels and partner
-- contacts the year genuinely isn't known, and a DATE forces you to invent one. This way
-- "29 July, year unknown" and "29 July 1984" are both representable and tell the truth.
--
-- The day/month remains the source of truth for "is it their birthday today" (src/lib/birthday.ts
-- and the hr_birthdays lookup), so nothing downstream changes when a year is absent.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS birthday_year SMALLINT;

-- Static bounds: a CHECK can't call NOW(), and "not in the future" is enforced in the app where
-- the current year is actually knowable. This just rules out typos and impossible values.
ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_birthday_year_range;
ALTER TABLE public.investors
  ADD CONSTRAINT investors_birthday_year_range
  CHECK (birthday_year IS NULL OR birthday_year BETWEEN 1900 AND 2100);

-- A year with no day/month would be an orphan: nothing displays or matches on it alone.
ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_birthday_year_needs_md;
ALTER TABLE public.investors
  ADD CONSTRAINT investors_birthday_year_needs_md
  CHECK (birthday_year IS NULL OR birthday_md IS NOT NULL);

ALTER TABLE public.franchise_partners
  ADD COLUMN IF NOT EXISTS contact_birthday_year SMALLINT;

ALTER TABLE public.franchise_partners
  DROP CONSTRAINT IF EXISTS franchise_partners_birthday_year_range;
ALTER TABLE public.franchise_partners
  ADD CONSTRAINT franchise_partners_birthday_year_range
  CHECK (contact_birthday_year IS NULL OR contact_birthday_year BETWEEN 1900 AND 2100);

ALTER TABLE public.franchise_partners
  DROP CONSTRAINT IF EXISTS franchise_partners_birthday_year_needs_md;
ALTER TABLE public.franchise_partners
  ADD CONSTRAINT franchise_partners_birthday_year_needs_md
  CHECK (contact_birthday_year IS NULL OR contact_birthday_md IS NOT NULL);
