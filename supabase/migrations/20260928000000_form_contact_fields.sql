-- The form asks for your name twice.
--
-- The renderer always appends a "Your Name / Your Email" step after the last question, because a
-- form that never asks who you are still has to put a name on the pipeline card. Fine for a form
-- that does not ask. The Partner Form does ask -- 20260908 authored name, email and phone as
-- questions -- so a founder types their name at question two and is asked for it again at the end,
-- which reads as us having lost the first answer. Jotforms does the same thing.
--
-- The renderer cannot tell which question was the name one. "What is your name?" is just text a
-- colleague typed into the builder, and matching on it would break the first time somebody wrote
-- "Who are we speaking to?". So the form says so explicitly, and the trailing step asks only for
-- what the answers did not already provide -- disappearing entirely when they provided both.
--
-- Tagged per node rather than per form because a branching form can ask for a name on one path and
-- not on another. What matters at submit time is whether the person actually reached that question,
-- and that is a fact about the answers, not about the form.
ALTER TABLE public.form_nodes
  ADD COLUMN IF NOT EXISTS contact_field TEXT
  CHECK (contact_field IS NULL OR contact_field IN ('name', 'email', 'phone'));

COMMENT ON COLUMN public.form_nodes.contact_field IS
  'This question collects the submitter''s name/email/phone. The public renderer skips its own trailing contact step for whichever of these the answers already carry. NULL for ordinary questions.';

-- ─── The forms that already ask ─────────────────────────────────────────────
-- Both Partner Forms (one per org) and Jotforms. Matched on the exact strings those forms hold
-- today rather than a LIKE, so this cannot reach into a question that merely mentions a name.
UPDATE public.form_nodes SET contact_field = 'name'
 WHERE type = 'question' AND question_text IN ('What is your name?', '**Your Name?**');

UPDATE public.form_nodes SET contact_field = 'email'
 WHERE type = 'question' AND question_text IN ('What is your email address?', '**Email**');

UPDATE public.form_nodes SET contact_field = 'phone'
 WHERE type = 'question' AND question_text = 'What is your phone number?';

-- ─── What the public page reads ─────────────────────────────────────────────
-- Same reasoning as 20260908: get_form_for_submission is the one function between an anonymous
-- visitor and the forms table, and it stays untouched. The wrapper merges the new key into each
-- node instead. A NULL from the inner function still passes straight through, so the page's error
-- handling is unchanged.
CREATE OR REPLACE FUNCTION public.get_public_form(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT to_jsonb(public.get_form_for_submission(p_token)) AS j
  )
  SELECT
    CASE
      -- Bad token, unpublished form, no pipeline. The inner function yields NULL and the page
      -- turns that into its own error screen, so this must stay NULL rather than become an object.
      -- jsonb_typeof is used instead of IS NULL because it answers for a JSON null too.
      WHEN jsonb_typeof(j) IS DISTINCT FROM 'object' THEN j
      ELSE
        j
        || jsonb_build_object(
             'form_display_name',
             (SELECT f.display_name
                FROM public.form_links fl
                JOIN public.forms f ON f.id = fl.form_id
               WHERE fl.token = p_token)
           )
        -- Each node gains contact_field. Rebuilt rather than patched in place because jsonb has no
        -- operator for "update every element of an array"; the node objects are otherwise passed
        -- through exactly as the inner function produced them. Guarded on the array actually being
        -- an array: jsonb_array_elements raises on a scalar, and this function is the one thing
        -- standing between a stranger and an error page.
        || CASE WHEN jsonb_typeof(j -> 'nodes') = 'array' THEN
             jsonb_build_object('nodes', COALESCE((
               SELECT jsonb_agg(
                        n || jsonb_build_object(
                          'contact_field',
                          (SELECT fn.contact_field
                             FROM public.form_nodes fn
                            WHERE fn.id = (n ->> 'id')::UUID)
                        )
                        ORDER BY ord
                      )
                 FROM jsonb_array_elements(j -> 'nodes') WITH ORDINALITY AS t(n, ord)
             ), '[]'::jsonb))
           ELSE '{}'::jsonb END
    END
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_form(TEXT) TO anon, authenticated;
