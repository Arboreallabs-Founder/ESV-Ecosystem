-- Seed two new deal categories for every existing org: Prefunding (early-stage engagements
-- ahead of a formal raise) and Secondary Sale (deals with a secondary share-sale component).
-- Guarded by NOT EXISTS so it's safe to re-run and won't duplicate a category someone already
-- created by hand with the same name.
WITH new_cats AS (
  INSERT INTO public.deal_categories (name, description, color, org_id)
  SELECT 'Prefunding', 'Early-stage engagements ahead of a formal raise.', '#0891b2', o.id
  FROM public.organizations o
  WHERE NOT EXISTS (SELECT 1 FROM public.deal_categories dc WHERE dc.org_id = o.id AND dc.name = 'Prefunding')
  UNION ALL
  SELECT 'Secondary Sale', 'Deals with a secondary share-sale component.', '#be185d', o.id
  FROM public.organizations o
  WHERE NOT EXISTS (SELECT 1 FROM public.deal_categories dc WHERE dc.org_id = o.id AND dc.name = 'Secondary Sale')
  RETURNING id, name
)
INSERT INTO public.deal_category_fields (category_id, label, field_type, required, "position")
SELECT new_cats.id, f.label, f.field_type, false, f.position
FROM new_cats
JOIN LATERAL (
  VALUES
    ('Prefunding', 'Engagement Letter', 'url', 0),
    ('Secondary Sale', 'Secondary Amount', 'numeric', 0),
    ('Secondary Sale', 'Price per Share', 'numeric', 1),
    ('Secondary Sale', 'Seller', 'text', 2),
    ('Secondary Sale', 'Success Fee', 'percentage', 3)
) AS f(cat_name, label, field_type, position) ON f.cat_name = new_cats.name;
