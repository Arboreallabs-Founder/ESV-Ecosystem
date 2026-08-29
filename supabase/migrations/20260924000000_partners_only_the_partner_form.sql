-- A partner may hold one link, on the partner form, and nothing else.
--
-- ─── What was actually true ─────────────────────────────────────────────────
-- "Org internal form links access" is an ALL policy and its role list included franchise_partner.
-- Permissive policies are OR'd, so the two narrow partner policies sitting beneath it —
-- "Partners create links on the partner form" and "Partners read own links" — decided nothing at
-- all. Whatever they said, the wide one had already said yes.
--
-- That gave a partner rather more than the ability to mint links:
--
--   * INSERT on any form in the org, not only the partner form, and any number of them
--   * SELECT with no created_by filter — every form link in the organisation, including the
--     internal ones for Series A and Pre-Seed applications
--   * UPDATE and DELETE on those same rows, so somebody else's live link could be removed
--
-- The Portal handed them the first of those directly: a dropdown of every published form and a
-- button that generates a link for whichever they pick.
--
-- This is the exact trap the 20260910 migration wrote down after the last one — "permissive
-- policies are OR'd, so adding a narrow one can only widen access; the wide one has to be found and
-- removed". The narrow policies were added and the wide one was left in place.

-- ─── 1. The wide policy stops covering partners ─────────────────────────────
DROP POLICY IF EXISTS "Org internal form links access" ON public.form_links;
CREATE POLICY "Org internal form links access"
  ON public.form_links FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      -- franchise_partner removed. Their access is the two narrow policies below and nothing else.
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_links.form_id AND f.org_id = public.get_user_org_id())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_links.form_id AND f.org_id = public.get_user_org_id())
    )
  );

-- Same shape on forms: partners could read every published form, which is what let the Portal offer
-- a dropdown of all of them. "Partners read the partner form" already says the right thing, so this
-- one only ever widened it.
DROP POLICY IF EXISTS "Franchise partners can read published forms" ON public.forms;

-- ─── 2. One link each ───────────────────────────────────────────────────────
-- A cap, not a convention. getOrCreateMyReferralLink is idempotent, but that is an application
-- promise: nothing stopped a partner posting to PostgREST in a loop, and "they would have to know
-- how" is not an access rule.
--
-- A trigger rather than a unique index, because the rule is about who the creator is. Internal
-- users legitimately hold several links on one form — the founder account has three on Series A
-- Application — so a plain UNIQUE (form_id, created_by) would break them to constrain partners.
CREATE OR REPLACE FUNCTION public.one_link_per_partner() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = NEW.created_by;
  IF coalesce(v_role, '') <> 'franchise_partner' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.form_links l
     WHERE l.created_by = NEW.created_by
       AND l.form_id = NEW.form_id
       AND l.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'You already have a referral link. Share the one you have rather than making another.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS form_links_one_per_partner ON public.form_links;
CREATE TRIGGER form_links_one_per_partner
  BEFORE INSERT ON public.form_links
  FOR EACH ROW EXECUTE FUNCTION public.one_link_per_partner();

COMMENT ON FUNCTION public.one_link_per_partner() IS
  'A partner holds one link per form. Internal users may hold several — the rule is about the creator, which is why this is a trigger and not a unique index.';
