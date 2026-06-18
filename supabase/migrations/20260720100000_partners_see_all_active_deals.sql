-- Let franchise partners see ALL active deals in their org (deal detail still
-- scopes investors/totals to their own referrals via existing policies).
--
-- Root cause: the "Partners read active deals" policy gates on an EXISTS over
-- pipeline_entries, which is itself RLS-filtered to entries the partner *sourced*
-- ("Partners read own sourced entries"). A partner with no form links sources no
-- entries and therefore sees no deals. We grant partners read on the entries that
-- sit behind any active deal in their org, which unlocks the deals via that EXISTS.
--
-- entry_has_active_deal() is SECURITY DEFINER so it bypasses active_deals RLS —
-- this avoids mutual RLS recursion between pipeline_entries and active_deals.

CREATE OR REPLACE FUNCTION public.entry_has_active_deal(p_entry_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_deals ad WHERE ad.pipeline_entry_id = p_entry_id
  );
$$;

DROP POLICY IF EXISTS "Partners read entries behind active deals" ON public.pipeline_entries;
CREATE POLICY "Partners read entries behind active deals"
  ON public.pipeline_entries FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND public.entry_has_active_deal(id)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
    )
  );
