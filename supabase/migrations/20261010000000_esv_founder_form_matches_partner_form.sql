-- The ESV founder form asks exactly what the Partner Form asks.
--
-- The link goes to startup founders who reached out to us; they fill it in, it lands on the ESV
-- Referrals pipeline, and once the team accepts it the company goes into the Companies database.
-- 20261009000000 gave it a short five-question placeholder. The team wants the same intake the
-- Partner Form already collects (20260908000000 + 20260925000000 wording), so this copies it.
--
-- ─── Copied, not re-typed ────────────────────────────────────────────────────
-- The graph is cloned from the org's live partner form at migration time — nodes, MCQ options,
-- edges, contact_field tags — so builder edits made since 20260908 come across too. Rows are copied
-- with jsonb_populate_record rather than a named column list: the form_* tables pre-date this
-- migration history, so a column list written here could silently drop one it doesn't know about.
-- Only ids are swapped. Branch edges carry the chosen option's id in condition_value (what the
-- renderer compares against), so those are remapped to the copied options' ids.
--
-- After this the two forms are independent copies: editing one in the builder does not change the
-- other.
--
-- Never rebuilt over answers — same rule as 20260908000000. If a founder has already submitted,
-- deleting the nodes would take their answers with them, so that org's form is left alone.

DO $$
DECLARE
  v_org     UUID;
  v_src     UUID;
  v_dst     UUID;
  v_answers INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _esv_node_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL);
  CREATE TEMP TABLE IF NOT EXISTS _esv_opt_map  (old_id UUID PRIMARY KEY, new_id UUID NOT NULL);

  FOR v_org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO v_src FROM public.forms WHERE org_id = v_org AND is_partner_form LIMIT 1;
    SELECT id INTO v_dst FROM public.forms WHERE org_id = v_org AND is_associate_form LIMIT 1;
    CONTINUE WHEN v_src IS NULL OR v_dst IS NULL;

    SELECT COUNT(*) INTO v_answers
      FROM public.pipeline_entry_answers a
      JOIN public.form_nodes n ON n.id = a.node_id
     WHERE n.form_id = v_dst;
    IF v_answers > 0 THEN
      RAISE NOTICE 'Org %: ESV founder form already has % answer(s); left unchanged.', v_org, v_answers;
      CONTINUE;
    END IF;

    TRUNCATE _esv_node_map, _esv_opt_map;

    -- Header: the founder-facing text is the partner form's (display_name/description — already
    -- written for a founder, no partner or pipeline language, no em dashes per 20260925). The
    -- internal title stays this form's own so the two are distinguishable in /forms.
    UPDATE public.forms d
       SET display_name = s.display_name,
           description  = s.description
      FROM public.forms s
     WHERE d.id = v_dst AND s.id = v_src;

    DELETE FROM public.form_edges WHERE form_id = v_dst;
    DELETE FROM public.form_node_options
     WHERE node_id IN (SELECT id FROM public.form_nodes WHERE form_id = v_dst);
    DELETE FROM public.form_nodes WHERE form_id = v_dst;

    INSERT INTO _esv_node_map (old_id, new_id)
      SELECT id, gen_random_uuid() FROM public.form_nodes WHERE form_id = v_src;
    INSERT INTO _esv_opt_map (old_id, new_id)
      SELECT o.id, gen_random_uuid()
        FROM public.form_node_options o JOIN _esv_node_map m ON m.old_id = o.node_id;

    INSERT INTO public.form_nodes
      SELECT (jsonb_populate_record(
               NULL::public.form_nodes,
               to_jsonb(n) || jsonb_build_object('id', m.new_id, 'form_id', v_dst)
             )).*
        FROM public.form_nodes n JOIN _esv_node_map m ON m.old_id = n.id;

    INSERT INTO public.form_node_options
      SELECT (jsonb_populate_record(
               NULL::public.form_node_options,
               to_jsonb(o) || jsonb_build_object('id', om.new_id, 'node_id', nm.new_id)
             )).*
        FROM public.form_node_options o
        JOIN _esv_opt_map  om ON om.old_id = o.id
        JOIN _esv_node_map nm ON nm.old_id = o.node_id;

    INSERT INTO public.form_edges
      SELECT (jsonb_populate_record(
               NULL::public.form_edges,
               to_jsonb(e) || jsonb_build_object(
                 'id',              gen_random_uuid(),
                 'form_id',         v_dst,
                 'source_node_id',  src.new_id,
                 'target_node_id',  tgt.new_id,
                 'condition_value', COALESCE(om.new_id::TEXT, e.condition_value)
               )
             )).*
        FROM public.form_edges e
        JOIN _esv_node_map src ON src.old_id = e.source_node_id
        JOIN _esv_node_map tgt ON tgt.old_id = e.target_node_id
        LEFT JOIN _esv_opt_map om ON om.old_id::TEXT = e.condition_value
       WHERE e.form_id = v_src;
  END LOOP;

  DROP TABLE IF EXISTS _esv_node_map;
  DROP TABLE IF EXISTS _esv_opt_map;
END $$;

-- ─── Companies only once accepted ────────────────────────────────────────────
-- submit_form_entry (20260726000000) creates-or-links a Company the moment ANY public form is
-- submitted. For this form that is wrong: a founder who reached out is not yet a company we're
-- tracking, and a rejected one would stay in the database as a "prospect" forever. Accepting the
-- entry already creates-or-links the company (acceptDeal, src/app/actions/active-deals.ts), so for
-- the ESV founder form the submission-time step is simply skipped.
--
-- Scoped to this form on purpose. The Partner Form and every other public form keep the existing
-- behaviour until someone decides otherwise. The body is otherwise 20260726000000 unchanged.
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
  v_is_founder_form boolean;
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

  -- The ESV founder form waits for acceptance (see above); everything else links at submission.
  SELECT is_associate_form INTO v_is_founder_form FROM forms WHERE id = p_form_id;
  IF coalesce(v_is_founder_form, false) THEN
    RETURN v_entry_id;
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
