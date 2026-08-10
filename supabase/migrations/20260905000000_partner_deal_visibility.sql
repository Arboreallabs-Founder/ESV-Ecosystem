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

-- Open the fields a partner legitimately needs: what is being raised, and the company''s numbers.
-- Matched on name because these are user-created rows with no stable identifier; anything not
-- matched simply stays private, which is the harmless direction.
UPDATE public.deal_category_fields
   SET visible_to_partners = true
 WHERE lower(btrim(name)) IN (
   'total capital being raised', 'total capital being raised ', 'capital being raised',
   'sector', 'arr', 'mrr', 'revenue', 'ebitda', 'gross margin', 'burn', 'runway',
   'instrument', 'valuation', 'pre-money', 'post-money'
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
  SELECT f.id, f.category_id, c.name AS category_name, f.name AS field_name
    FROM public.deal_category_fields f
    JOIN public.deal_categories c ON c.id = f.category_id
   WHERE f.visible_to_partners;
