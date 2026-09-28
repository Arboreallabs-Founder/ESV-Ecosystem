-- Readable share links for the ESV founder form: /apply/sakshay instead of /f/<random token>.
--
-- The links get posted on LinkedIn, where a long random token reads as a tracking link. A slug is a
-- second, human name for the same form_links row; /f/<token> keeps working, so nothing already
-- shared breaks, and attribution is unchanged (it runs off the link row, not how it was reached).
--
-- Slugs only on the founder form (is_associate_form). form_link tokens are otherwise treated as
-- bearer secrets (20260920000000) — internal forms rely on nobody being able to guess them. The
-- founder form is public by design, so a guessable name costs nothing there; the worst a guess can
-- do is submit through a colleague's link and credit them instead.

ALTER TABLE public.form_links ADD COLUMN IF NOT EXISTS slug TEXT;

-- Globally unique, not per org: the URL has no org in it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_links_slug ON public.form_links (lower(slug)) WHERE slug IS NOT NULL;

ALTER TABLE public.form_links DROP CONSTRAINT IF EXISTS form_links_slug_format;
ALTER TABLE public.form_links ADD CONSTRAINT form_links_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 40);

-- ─── Picking a slug ──────────────────────────────────────────────────────────
-- First name, lowercased, letters and digits only; "-2", "-3"… on a clash. Falls back to the email's
-- local part when there's no usable name. SECURITY DEFINER because it reads users and must see every
-- existing slug to avoid a clash, whoever is creating the link.
CREATE OR REPLACE FUNCTION public.referral_slug_for(p_user UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name  TEXT;
  v_email TEXT;
  v_base  TEXT;
  v_slug  TEXT;
  v_n     INT := 1;
BEGIN
  SELECT name, email INTO v_name, v_email FROM public.users WHERE id = p_user;
  v_base := lower(regexp_replace(split_part(trim(coalesce(v_name, '')), ' ', 1), '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_base) < 2 THEN
    v_base := lower(regexp_replace(split_part(coalesce(v_email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  END IF;
  IF length(v_base) < 2 THEN
    v_base := 'team';
  END IF;
  v_base := left(v_base, 34);   -- room for "-NNNN" inside the 40-character limit

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.form_links WHERE lower(slug) = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;
  RETURN v_slug;
END $$;

REVOKE ALL ON FUNCTION public.referral_slug_for(UUID) FROM PUBLIC, anon, authenticated;

-- ─── Keeping slugs to the founder form, and giving new links one ─────────────
-- A trigger rather than app code so every way a link gets created (the /referrals button, the Share
-- tab, a direct insert) gets a slug, and no path can put one on an internal form.
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

  IF NEW.slug IS NOT NULL THEN
    IF NOT coalesce(v_is_founder_form, false) THEN
      RAISE EXCEPTION 'Only links on the ESV founder form can have a readable name.';
    END IF;
    NEW.slug := lower(trim(NEW.slug));
  ELSIF TG_OP = 'INSERT' AND coalesce(v_is_founder_form, false) AND NEW.created_by IS NOT NULL THEN
    NEW.slug := public.referral_slug_for(NEW.created_by);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS form_links_referral_slug ON public.form_links;
CREATE TRIGGER form_links_referral_slug
  BEFORE INSERT OR UPDATE OF slug, form_id ON public.form_links
  FOR EACH ROW EXECUTE FUNCTION public.form_links_referral_slug();

-- ─── Everyone who already has a link ─────────────────────────────────────────
-- Oldest link first, so whoever has been here longest keeps the plain first name on a clash.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT fl.id, fl.created_by
      FROM public.form_links fl
      JOIN public.forms f ON f.id = fl.form_id
     WHERE f.is_associate_form AND fl.slug IS NULL AND fl.created_by IS NOT NULL
     ORDER BY fl.created_at
  LOOP
    UPDATE public.form_links SET slug = public.referral_slug_for(r.created_by) WHERE id = r.id;
  END LOOP;
END $$;

-- ─── Public lookup ───────────────────────────────────────────────────────────
-- /apply/<slug> resolves to the link's token and then renders exactly what /f/<token> renders.
-- Returning the token to an anonymous caller discloses nothing new: anyone holding the slug can
-- already submit through that link. Scoped to the founder form so it can never resolve anything else.
CREATE OR REPLACE FUNCTION public.resolve_referral_slug(p_slug TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fl.token::TEXT
    FROM public.form_links fl
    JOIN public.forms f ON f.id = fl.form_id
   WHERE lower(fl.slug) = lower(trim(p_slug))
     AND f.is_associate_form
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_referral_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_slug(TEXT) TO anon, authenticated;
