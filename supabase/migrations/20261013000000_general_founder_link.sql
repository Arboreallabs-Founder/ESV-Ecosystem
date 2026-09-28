-- One general founder link, for the ESV website and the company LinkedIn page: /apply.
--
-- Every founder-form link so far belongs to a team member and credits them (attribute_entry_to_
-- sourcer, 20261007000000). A link on the website isn't anyone's, and crediting it to whoever made it
-- would inflate their count on /admin/referrals. So the general link is a form_links row on the same
-- founder form with no creator: same questions, same ESV Referrals pipeline, same company-profile fill
-- on acceptance — and the attribution trigger, which joins the creator, credits nobody.

ALTER TABLE public.form_links ADD COLUMN IF NOT EXISTS is_general BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.form_links.is_general IS
  'The founder form''s general link (/apply) — on the website and company page, credited to nobody. One per form. See 20261013000000.';

-- It has no creator. A no-op where created_by is already nullable.
ALTER TABLE public.form_links ALTER COLUMN created_by DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_links_one_general
  ON public.form_links (form_id) WHERE is_general;

-- ─── Slug trigger: general links are founder-form only, and get no personal slug ──
-- Same function as 20261011000000, plus the is_general rules. The general link is reached at the bare
-- /apply, so it needs no slug.
CREATE OR REPLACE FUNCTION public.form_links_referral_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_founder_form BOOLEAN;
BEGIN
  SELECT is_associate_form INTO v_is_founder_form FROM public.forms WHERE id = NEW.form_id;

  IF NEW.is_general AND NOT coalesce(v_is_founder_form, false) THEN
    RAISE EXCEPTION 'Only the ESV founder form has a general link.';
  END IF;

  IF NEW.slug IS NOT NULL THEN
    IF NOT coalesce(v_is_founder_form, false) THEN
      RAISE EXCEPTION 'Only links on the ESV founder form can have a readable name.';
    END IF;
    NEW.slug := lower(trim(NEW.slug));
  ELSIF TG_OP = 'INSERT' AND coalesce(v_is_founder_form, false) AND NEW.created_by IS NOT NULL AND NOT NEW.is_general THEN
    NEW.slug := public.referral_slug_for(NEW.created_by);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS form_links_referral_slug ON public.form_links;
CREATE TRIGGER form_links_referral_slug
  BEFORE INSERT OR UPDATE OF slug, form_id, is_general ON public.form_links
  FOR EACH ROW EXECUTE FUNCTION public.form_links_referral_slug();

-- ─── Nobody deletes it by accident ──────────────────────────────────────────
-- Associates may manage form_links ("Org internal form links access"), and the builder's Share tab
-- lists every link on a form. Deleting this one would break the website's Apply button, so only
-- founder/admin (or the SQL editor) may remove it or change what it is.
CREATE OR REPLACE FUNCTION public.protect_general_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IN ('founder', 'admin') OR public.is_super_admin() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_general THEN
    RAISE EXCEPTION 'This is the general link on the ESV website. Only a founder or admin can remove it.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_general IS DISTINCT FROM OLD.is_general THEN
    RAISE EXCEPTION 'Only a founder or admin can change which link is the general one.';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS form_links_protect_general ON public.form_links;
CREATE TRIGGER form_links_protect_general
  BEFORE UPDATE OR DELETE ON public.form_links
  FOR EACH ROW EXECUTE FUNCTION public.protect_general_link();

-- ─── The link itself ─────────────────────────────────────────────────────────
INSERT INTO public.form_links (form_id, created_by, label, is_general)
SELECT f.id, NULL, 'General (website and company page)', true
  FROM public.forms f
 WHERE f.is_associate_form
   AND NOT EXISTS (SELECT 1 FROM public.form_links l WHERE l.form_id = f.id AND l.is_general);

-- ─── Public lookup for /apply ────────────────────────────────────────────────
-- Same reasoning as resolve_referral_slug: the token is what anyone holding the URL can already use.
-- The URL carries no org, so with more than one org the oldest general link answers.
CREATE OR REPLACE FUNCTION public.resolve_general_founder_link()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fl.token::TEXT
    FROM public.form_links fl
    JOIN public.forms f ON f.id = fl.form_id
   WHERE fl.is_general AND f.is_associate_form
   ORDER BY fl.created_at
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_general_founder_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_general_founder_link() TO anon, authenticated;
