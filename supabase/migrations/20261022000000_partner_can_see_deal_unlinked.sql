-- Fix: a partner user with no partner record stopped seeing any deal.
--
-- 20261020000000 replaced the portal's visibility test with partner_can_see_deal(), and wrote the
-- franchise_partners lookup as an INNER JOIN:
--
--     JOIN public.franchise_partners fp ON fp.id = u.franchise_partner_id
--
-- The path it replaced never touched that table — it asked `visible_to_partners` and the user's org,
-- and nothing else. So for a `franchise_partner` user whose `franchise_partner_id` is still NULL,
-- the join matched nothing, the predicate returned false, and their portal emptied.
--
-- That state is real and routine, not a corner case: a partner is created as a user first and the
-- agreement details are filled in afterwards, which is why /admin/partners carries a standing
-- "N partners are missing details" banner. Those are exactly the accounts this broke, and it would
-- have read as "the portal is blank" with nothing pointing here.
--
-- Two changes, both restoring what the old path did:
--
--   * LEFT JOIN, with the tier read through COALESCE(..., 'sgp'). An unlinked partner has no tier,
--     and the tier column already defaults to 'sgp' precisely so that nobody is narrowed by a
--     schema change. Only a partner explicitly marked 'venture' is gated to named deals.
--   * The org comparison goes back to the user's own org (u.org_id) rather than the partner
--     record's. They agree wherever both exist, but the user's org is the one the previous policy
--     used and the one that still exists when the partner record does not.
--
-- Venture gating is unaffected: it needs a franchise_partners row to be set to 'venture' in the
-- first place, so an unlinked account can never be venture-tier.

CREATE OR REPLACE FUNCTION public.partner_can_see_deal(p_deal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.active_deals d
      JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
      JOIN public.pipelines p        ON p.id = e.pipeline_id
      JOIN public.users u            ON u.id = auth.uid()
      LEFT JOIN public.franchise_partners fp ON fp.id = u.franchise_partner_id
     WHERE d.id = p_deal_id
       AND u.role = 'franchise_partner'
       AND p.org_id = u.org_id
       -- Rows predating the column read as visible, matching the column default and the app.
       AND d.visible_to_partners IS NOT FALSE
       AND (
         COALESCE(fp.partner_tier, 'sgp') <> 'venture'
         OR EXISTS (
           SELECT 1 FROM public.active_deal_partner_access a
            WHERE a.active_deal_id = d.id AND a.partner_id = fp.id
         )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.partner_can_see_deal(UUID) TO authenticated;

-- entry_has_partner_visible_deal, get_partner_deal_summary and get_partner_deal_summaries all call
-- this by name and need no change — which is the point of their having one predicate between them.
