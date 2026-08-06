-- Let founders and admins decide which active deals partners can see.
--
-- Until now partners saw every active deal in the org (see
-- 20260720100000_partners_see_all_active_deals.sql). That was a deliberate widening at the time,
-- but it leaves no way to keep a sensitive deal off the partner portal.
--
-- Default is TRUE on purpose. Partners can see every deal today; defaulting to FALSE would empty
-- their portal the moment this migration runs, which is a support ticket, not a feature. The
-- control is therefore "hide this one", not "share this one". Flipping the default for new deals
-- is a one-line change here if the org would rather it be opt-in.

ALTER TABLE public.active_deals
  ADD COLUMN IF NOT EXISTS visible_to_partners BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.active_deals.visible_to_partners IS
  'False hides the deal from the franchise partner portal. Internal roles are unaffected.';

-- Partial index: the interesting set is the small one, the deals someone chose to hide.
CREATE INDEX IF NOT EXISTS idx_active_deals_hidden_from_partners
  ON public.active_deals(pipeline_entry_id) WHERE NOT visible_to_partners;

-- ─── The enforcement point ──────────────────────────────────────────────────
-- Partners do not reach active_deals directly. Their read is an EXISTS over pipeline_entries,
-- and pipeline_entries is opened to them by the policy below. So gating THIS closes the whole
-- path: no entry row, no deal row, no stage answers hanging off it.
--
-- Doing it here rather than by adding a policy to active_deals is deliberate. Permissive policies
-- are OR'd together, so an extra policy could only ever widen partner access, never narrow it —
-- and the existing partner policy on active_deals was created outside this migration history, so
-- its exact name is not knowable from the repo.
--
-- SECURITY DEFINER to avoid mutual RLS recursion between pipeline_entries and active_deals; it
-- answers one boolean about one row and leaks nothing else.
CREATE OR REPLACE FUNCTION public.entry_has_partner_visible_deal(p_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_deals ad
    WHERE ad.pipeline_entry_id = p_entry_id
      AND ad.visible_to_partners
  );
$$;

DROP POLICY IF EXISTS "Partners read entries behind active deals" ON public.pipeline_entries;
CREATE POLICY "Partners read entries behind active deals"
  ON public.pipeline_entries FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND public.entry_has_partner_visible_deal(id)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
    )
  );

-- entry_has_active_deal() is left in place: a partner may still have sourced an entry themselves,
-- which is granted by a separate policy and has nothing to do with this toggle.

-- ─── What is deliberately NOT hidden ────────────────────────────────────────
-- active_deal_partner_shares is untouched. A share is money owed to that partner for a deal they
-- brought in; hiding the deal must not quietly erase the record of what they are owed. If a deal
-- needs to be hidden from the partner who sourced it, that is a different decision from this one
-- and should be made explicitly.
