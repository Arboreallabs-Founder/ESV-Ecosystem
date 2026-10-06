-- A partner's investor list shows their whole subtree, not just direct referrals.
--
-- 20261018000000 made credit roll up a chain, and 20261019000000 made the earnings and the tree
-- diagram follow it. The investor LIST did not move: the partner SELECT policy still matches
-- `referred_by_partner_id = <their partner id>`, which is true only of the investors they
-- introduced themselves.
--
-- So a partner with Aster -> Bluefin -> Coral saw exactly one fund, while /earnings showed them a
-- tree of four and paid them on all of it. Two screens disagreeing about who a partner's investors
-- are is worse than either answer alone, and the list is the one that is wrong: the whole point of
-- the chain is that the partner is credited for everything under them, so everything under them is
-- theirs to see.
--
-- ─── Added, not edited ──────────────────────────────────────────────────────
-- The existing partner SELECT policy was created outside this migration history, so its name is not
-- knowable from the repo (same situation 20260828000000 ran into with active_deals). Permissive
-- policies are OR'd together, so a new one widens the set without needing to find the old one.
-- Here widening is exactly the intent — which is the opposite of the 20260828 case, where that same
-- property was the hazard.

-- ─── The id set, resolved once per query ────────────────────────────────────
-- Takes no arguments and derives everything from auth.uid(), so it cannot be pointed at another
-- partner's subtree. SECURITY DEFINER because investor_referral_roots is revoked from
-- `authenticated` (20261018000000) — a policy expression runs with the querying user's privileges,
-- so referencing that view directly from a policy would fail on permissions.
--
-- Set-returning, uncorrelated and STABLE on purpose: the planner evaluates it once as an InitPlan
-- rather than per row. The obvious alternative, `investor_root_partner(id) = ...` in the policy,
-- would run one recursive CTE for every row of the investor table on every read.
CREATE OR REPLACE FUNCTION public.my_partner_investor_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.investor_id
    FROM public.investor_referral_roots r
   WHERE r.root_partner_id = (
     SELECT u.franchise_partner_id FROM public.users u WHERE u.id = auth.uid()
   );
$$;

REVOKE ALL ON FUNCTION public.my_partner_investor_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_partner_investor_ids() TO authenticated;

COMMENT ON FUNCTION public.my_partner_investor_ids() IS
  'Every investor rolling up to the calling partner, at any depth. Derived from auth.uid(); takes no arguments so it cannot be aimed elsewhere.';

-- ─── The policy ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Partners read their referral subtree" ON public.investors;
CREATE POLICY "Partners read their referral subtree"
  ON public.investors FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND id IN (SELECT public.my_partner_investor_ids())
  );

-- ─── What is deliberately NOT widened ───────────────────────────────────────
-- UPDATE stays pinned to direct referrals ("Partners update own referred investors",
-- 20260720000000). Seeing a fund your investor introduced is reasonable — you are paid on it.
-- Editing that fund's record is not: the relationship is not yours, and the partner who does own it
-- would have no idea their record had been changed.
--
-- investor_contacts is also untouched. The names and numbers at a fund are the proprietary half of
-- this database, and nothing about being credited for a chain argues for handing over the contact
-- book of a fund you have never spoken to. If that turns out to be wanted, it is its own decision.
