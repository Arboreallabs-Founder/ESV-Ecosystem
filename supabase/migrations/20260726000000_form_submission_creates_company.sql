-- Self-submitted companies: when a public form submission lands in the pipeline, create-or-link
-- a Company Profile (by name) and attach it to the new pipeline entry. Runs inside the existing
-- SECURITY DEFINER submission RPC (anon has no rights to write companies directly).

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
  v_org_id uuid;
  v_company_id uuid;
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

  -- Self-submitted company → create-or-link a Company Profile by name (skip the generic fallback title).
  SELECT org_id INTO v_org_id FROM pipelines WHERE id = p_pipeline_id;
  IF v_org_id IS NOT NULL AND v_title IS NOT NULL AND v_title <> '' AND v_title <> 'Form submission' THEN
    SELECT id INTO v_company_id FROM companies WHERE org_id = v_org_id AND lower(name) = lower(v_title) LIMIT 1;
    IF v_company_id IS NULL THEN
      INSERT INTO companies (org_id, name, status) VALUES (v_org_id, v_title, 'prospect') RETURNING id INTO v_company_id;
    END IF;
    UPDATE pipeline_entries SET company_id = v_company_id WHERE id = v_entry_id;
  END IF;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_form_entry(uuid, uuid, uuid, uuid, jsonb, text, text) TO anon, authenticated;
