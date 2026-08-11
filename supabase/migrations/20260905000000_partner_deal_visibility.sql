-- What a partner may see on a deal, and stopping partners creating investors.
--
-- Two separate decisions that both come down to the same thing: a partner is a referrer, not a
-- member of the deal team, and the app had been treating them as a lightweight internal user.

-- ─── 1. Per-field visibility on deals ───────────────────────────────────────
-- Deal category fields are user-defined (success fee, transaction fee, IM link, mandate link, ARR,
-- instrument…), so which of them a partner may see cannot be hardcoded — someone will add a field
-- tomorrow. It is a flag on the field, defaulting to FALSE: a new field is private until somebody
-- decides otherwise, which is the safe direction for a list that includes fee structures.
ALTER TABLE public.deal_category_fields
  ADD COLUMN IF NOT EXISTS visible_to_partners BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deal_category_fields.visible_to_partners IS
  'Partners see this field on the deal. Default false — fee structures and mandate links are not theirs to read.';

-- Open the fields a partner legitimately needs: what is being raised, and the company's numbers.
-- Matched on the label because these are user-created rows with no stable identifier, and matched
-- case-insensitively because the same field exists as both "Total Capital Being Raised" and
-- "Total Capital Being raised" on two different categories.
--
-- Deal *terms* are deliberately absent — pre-money valuation, equity %, our ticket size, instrument,
-- round details. A partner is told what the company is raising, not what we are getting. Anything
-- not listed here simply stays private, which is the harmless direction, and can be opened one
-- field at a time in Admin → Deal Categories.
UPDATE public.deal_category_fields
   SET visible_to_partners = true
 WHERE lower(btrim(label)) IN (
   -- what is being raised
   'total capital being raised', 'capital being raised',
   -- the company's own numbers
   'arr', 'mrr', 'monthly revenue (usd)', 'runway (months)',
   'revenue', 'ebitda', 'gross margin', 'burn', 'runway',
   -- what it does
   'sector'
 );

-- ─── 2. Partners no longer create investors ─────────────────────────────────
-- A partner adding an investor we already hold creates a duplicate record and a fee-split claim
-- over a relationship that was already ours. They tell us instead, and we link the partner to the
-- existing investor via referred_by_partner_id — which already exists and is already on the form.
DROP POLICY IF EXISTS "Partners insert own referrals" ON public.investors;
DROP POLICY IF EXISTS "Partners update own referrals" ON public.investors;
DROP POLICY IF EXISTS "Partners manage own referrals" ON public.investors;

-- Reading stays: a partner should still see the investor database, they just cannot add to it.
-- (The existing partner SELECT policy is untouched.)

DROP POLICY IF EXISTS "Partners insert contacts" ON public.investor_contacts;
DROP POLICY IF EXISTS "Partners manage own referral contacts" ON public.investor_contacts;

-- ─── Verification helper ────────────────────────────────────────────────────
-- Which fields a partner can see, in one query, because "what does a partner see" should be
-- answerable without reading the UI.
CREATE OR REPLACE VIEW public.partner_visible_deal_fields AS
  SELECT f.id, f.category_id, c.name AS category_name, f.label AS field_name
    FROM public.deal_category_fields f
    JOIN public.deal_categories c ON c.id = f.category_id
   WHERE f.visible_to_partners;
