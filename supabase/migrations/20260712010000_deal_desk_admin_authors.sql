-- Deal Desk: allow admins to author cards too (in addition to associates).
-- Admins were already reviewers; this lets them create/import their own deals.
-- Only the INSERT policy needs widening — UPDATE/DELETE already permit founder/admin,
-- and desk_deal_media writes are keyed on associate_id = auth.uid() (the author), which
-- covers an admin acting on their own deals.

DROP POLICY IF EXISTS "Desk deals insert" ON public.desk_deals;
CREATE POLICY "Desk deals insert" ON public.desk_deals
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'admin')
    AND associate_id = auth.uid()
  );
