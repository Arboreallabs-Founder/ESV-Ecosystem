-- Why a share link isn't working.
--
-- Nothing about a form link ever expires — there is no expiry column and never has been. But
-- get_form_for_submission requires forms.published = true, so unpublishing a form silently kills
-- every link already handed out, and the public page told visitors the link "may have expired".
-- That sent people looking for a link problem when the fix was to republish the form.
--
-- This returns the actual reason. SECURITY DEFINER so an anonymous visitor can be told the truth
-- without being granted SELECT on `forms`.
--
-- It reveals only whether a token exists and whether its form is accepting responses. Tokens are
-- unguessable, and someone holding one already knows it exists — what they cannot currently tell
-- is whether the problem is theirs or ours.

CREATE OR REPLACE FUNCTION public.get_form_link_status(p_token TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN fl.id IS NULL THEN 'unknown'          -- no such link
    WHEN NOT f.published THEN 'unpublished'    -- link is fine; the form is a draft
    WHEN f.pipeline_id IS NULL THEN 'no_pipeline'
    ELSE 'ok'
  END
  FROM (SELECT p_token AS token) t
  LEFT JOIN public.form_links fl ON fl.token = t.token
  LEFT JOIN public.forms f ON f.id = fl.form_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_link_status(TEXT) TO anon, authenticated;
