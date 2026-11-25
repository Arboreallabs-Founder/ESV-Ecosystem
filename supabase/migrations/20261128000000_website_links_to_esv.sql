-- The website's links go to ESV's own workspace.
--
-- 20261013000000 gave every organisation's founder form a general link in one statement, so they share
-- a created_at, and resolve_general_founder_link() picks "the oldest". Which one won the tie was chance,
-- and it was another organisation's: /apply has been feeding that organisation's pipeline, and
-- 20261126000000, which looked up the organisation the same way, built the syndicate and growth partner
-- forms there too. (The team's own /apply/<name> links were never affected: a name belongs to one link.)
--
-- ESV is the organisation whose founder form carries the team's named links.

DO $$
DECLARE
  v_esv  UUID;
  v_tied BOOLEAN;
BEGIN
  WITH named AS (
    SELECT f.org_id, count(*) AS n
      FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
     WHERE f.is_associate_form AND fl.slug IS NOT NULL AND fl.created_by IS NOT NULL
     GROUP BY f.org_id
  )
  SELECT (SELECT org_id FROM named ORDER BY n DESC LIMIT 1),
         (SELECT count(*) > 1 FROM named WHERE n = (SELECT max(n) FROM named))
    INTO v_esv, v_tied;
  IF v_esv IS NULL OR v_tied THEN
    RAISE EXCEPTION 'Could not tell which organisation is ESV. Nothing was changed.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
     WHERE f.org_id = v_esv AND f.is_associate_form AND fl.is_general
  ) THEN
    RAISE EXCEPTION 'The ESV founder form has no general link. Nothing was changed.';
  END IF;

  -- /apply: only ESV's founder form keeps a general link. The other link still exists at its /f/ address.
  UPDATE public.form_links fl SET is_general = false
    FROM public.forms f
   WHERE f.id = fl.form_id AND f.is_associate_form AND f.org_id <> v_esv AND fl.is_general;

  -- The two website forms, their pipelines, and the investor relations tasks on them. Stages, questions,
  -- options and links hang off these and need no change.
  UPDATE public.pipeline_stage_tasks t SET org_id = v_esv
    FROM public.pipeline_stages s, public.forms f
   WHERE s.id = t.stage_id AND f.pipeline_id = s.pipeline_id AND f.is_website_form AND t.org_id <> v_esv;
  UPDATE public.pipelines p SET org_id = v_esv
    FROM public.forms f WHERE f.pipeline_id = p.id AND f.is_website_form AND p.org_id <> v_esv;
  UPDATE public.forms SET org_id = v_esv WHERE is_website_form AND org_id <> v_esv;
END $$;

-- Never ambiguous again: one bare /apply link in the whole database. (Website forms' links have names.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_links_one_bare_general
  ON public.form_links ((true)) WHERE is_general AND slug IS NULL;

-- What it did.
SELECT f.title AS form, p.name AS pipeline, o.name AS organisation, f.published,
       coalesce('/apply/' || fl.slug, '/apply') AS link
  FROM public.form_links fl
  JOIN public.forms f ON f.id = fl.form_id
  JOIN public.pipelines p ON p.id = f.pipeline_id
  JOIN public.organizations o ON o.id = f.org_id
 WHERE fl.is_general
 ORDER BY link;
