-- Scope each investor commitment to one of the deal's categories, so a hybrid deal (e.g.
-- Syndicate + Secondary Sale) can show a separate investor list per category instead of one
-- merged list. NULL = "Unassigned" (no category, or a category since removed from the deal).
ALTER TABLE public.active_deal_investors
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.deal_categories(id);

-- Backfill: for deals with exactly one category, their existing investors clearly belong to it.
-- Deals that already had 2+ categories with pre-existing investors are left NULL (Unassigned)
-- rather than guessed at.
UPDATE public.active_deal_investors adi
SET category_id = single_cat.category_id
FROM (
  SELECT active_deal_id, (array_agg(category_id))[1] AS category_id
  FROM public.active_deal_categories
  GROUP BY active_deal_id
  HAVING COUNT(*) = 1
) AS single_cat
WHERE adi.active_deal_id = single_cat.active_deal_id
  AND adi.category_id IS NULL;
