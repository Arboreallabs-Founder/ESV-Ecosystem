-- What a partner is supposed to see on a deal, actually reaching them.
--
-- 20260905 decided which deal *fields* a partner may read, and that works. But four other things on
-- the deal page were coming back empty for partners, not because anyone decided they should, but
-- because the page derives them from rows that RLS correctly hides:
--
--   * Raise progress read "₹0 committed, 0 commitments" on a deal that is ₹1.08 Cr in from eleven
--     investors. The number is computed client-side by summing active_deal_investors, and a partner
--     can see none of those rows. So the one thing the spec explicitly promised them — how much has
--     been raised — was the one thing showing zero.
--   * The ESV point of contact read "No one assigned". Assignees are read through
--     pipeline_entry_assignees → users, and a partner cannot read the user directory.
--   * The company logo fell back to a coloured initial, because it lives on companies.
--   * "No company profile linked" on a deal that has one.
--
-- The fix is not to widen those policies. A partner must not be able to read the investor rows (the
-- names on a cap table are the whole asset), the user directory, or the company database. Instead
-- this returns the exact projection they are allowed: aggregates, not rows; names of the people
-- they already deal with, not the staff list.
--
-- SECURITY DEFINER, so it is the function — not RLS — that decides. It therefore re-checks
-- everything itself: the caller is a partner, the deal is in their org, and the deal has actually
-- been made visible to partners. Any of those failing returns NULL rather than a partial object.

CREATE OR REPLACE FUNCTION public.get_partner_deal_summary(p_deal_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    -- Cosmetic, but the fallback initial made the deal look like a different company to the partner
    -- than it does to us.
    'logo_url',         COALESCE(d.logo_url, c.logo_url),
    'company_name',     c.name,
    -- The quantum raised so far. Summed here, over rows the caller cannot select, which is the
    -- entire point: they learn the total without learning who is in it.
    'committed_total',  COALESCE(agg.total, 0),
    -- A count, not a list. Five investors being in says the deal is moving; which five is ours.
    'commitment_count', COALESCE(agg.n, 0),
    -- Who to talk to on our side. Name and photo only — no email, role or user id beyond what the
    -- chip needs to render.
    'assignees',        COALESCE(ass.list, '[]'::jsonb)
  )
  FROM public.active_deals d
  JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
  JOIN public.pipelines p        ON p.id = e.pipeline_id
  LEFT JOIN public.companies c   ON c.id = e.company_id
  LEFT JOIN LATERAL (
    -- No is_investing filter: the internal page sums every row on the deal, and a partner seeing a
    -- different total from the team is worse than either total on its own.
    SELECT SUM(i.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors i
     WHERE i.active_deal_id = d.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object('user_id', a.user_id, 'name', u.name, 'photo_url', u.photo_url)
             ORDER BY u.name
           ) AS list
      FROM public.pipeline_entry_assignees a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.entry_id = e.id
  ) ass ON TRUE
  WHERE d.id = p_deal_id
    AND public.get_user_role() = 'franchise_partner'
    AND p.org_id = public.get_user_org_id()
    -- Rows predating the column read as visible, matching the column default and the app.
    AND d.visible_to_partners IS NOT FALSE;
$$;

-- Partners only. Nobody else has a use for it — internal roles read the rows directly — and a
-- SECURITY DEFINER function granted broadly is a standing invitation.
GRANT EXECUTE ON FUNCTION public.get_partner_deal_summary(UUID) TO authenticated;
