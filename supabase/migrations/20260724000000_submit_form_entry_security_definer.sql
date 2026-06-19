-- Public form submission failed under RLS: the anon INSERT policy on pipeline_entries
-- did an EXISTS join into `forms`, but anon has no SELECT policy on forms (the only
-- forms read policy is scoped to franchise_partner), so the WITH CHECK always failed.
-- The RETURNING id also needed an anon SELECT policy that didn't exist.
-- Route the whole submission through a SECURITY DEFINER RPC that validates server-side
-- and bypasses RLS, mirroring get_form_for_submission.
CREATE OR REPLACE FUNCTION public.submit_form_entry(
  p_link_id uuid,
  p_form_id uuid,
  p_pipeline_id uuid,
  p_first_stage_id uuid,
  p_answers jsonb,
  p_submitter_name text,
  p_submitter_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_title text;
BEGIN
  -- Validate: published form, link belongs to the form, pipeline matches the form
  IF NOT EXISTS (
    SELECT 1 FROM form_links fl
    JOIN forms f ON f.id = fl.form_id
    WHERE fl.id = p_link_id
      AND f.id = p_form_id
      AND f.published = true
      AND f.pipeline_id = p_pipeline_id
  ) THEN
    RAISE EXCEPTION 'Form not available for submission';
  END IF;

  v_title := COALESCE(NULLIF(LEFT((p_answers->0->>'answer_text'), 120), ''), 'Form submission');

  INSERT INTO pipeline_entries (pipeline_id, form_id, form_link_id, stage_id, title, submitter_name, submitter_email)
  VALUES (p_pipeline_id, p_form_id, p_link_id, p_first_stage_id, v_title,
          NULLIF(p_submitter_name, ''), NULLIF(p_submitter_email, ''))
  RETURNING id INTO v_entry_id;

  IF p_answers IS NOT NULL AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO pipeline_entry_answers (entry_id, node_id, answer_text)
    SELECT v_entry_id, (a->>'node_id')::uuid, a->>'answer_text'
    FROM jsonb_array_elements(p_answers) AS a;
  END IF;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_form_entry(uuid, uuid, uuid, uuid, jsonb, text, text) TO anon, authenticated;
