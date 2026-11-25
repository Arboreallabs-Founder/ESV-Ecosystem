-- Internship applications: who handles them, and applicants under 18.
--
--  1. Recruitment (HR): a flag on a person, like Investor Relations. They get a task for every new
--     internship application and are assigned to it. Unlike Investor Relations it also gives access,
--     because the HR role sees no pipelines and the task would point at a page they can't open: read
--     and move entries on recruitment pipelines (Interns), and nothing else.
--  2. Under 18: answering "No" to "Are you 18 or older?" ends the form and nothing is stored (decided
--     25 November 2026, instead of the spec's flag: the privacy policy says the forms are for adults).
--
-- Run 20261129000000_internship_form.sql first. Does not publish the form. Safe to run again.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
     WHERE fl.slug = 'intern' AND f.is_website_form
  ) THEN
    RAISE EXCEPTION 'Run 20261129000000_internship_form.sql first.';
  END IF;
END $$;

-- ─── The flags ───────────────────────────────────────────────────────────────
-- Both are changed only by founders and admins: users has no other UPDATE policy, and a recruiter has
-- none on pipelines.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_recruitment BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.users.is_recruitment IS
  'Recruitment (HR): gets the automatic pipeline tasks addressed to recruitment, and can work the recruitment pipelines. Set by founder/admin in Admin > Users.';

ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS is_recruitment BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pipelines.is_recruitment IS
  'People flagged users.is_recruitment can read this pipeline and move its entries, whatever their role.';

UPDATE public.pipelines SET is_recruitment = true
 WHERE id = (SELECT f.pipeline_id FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
              WHERE fl.slug = 'intern' AND f.is_website_form);

-- ─── What it opens ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recruits_on(p_pipeline UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pipelines p
      JOIN public.users u ON u.org_id = p.org_id
     WHERE p.id = p_pipeline AND p.is_recruitment
       AND u.id = auth.uid() AND u.is_recruitment AND u.role <> 'franchise_partner'
  );
$$;

CREATE OR REPLACE FUNCTION public.recruits_on_form(p_form UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.recruits_on((SELECT pipeline_id FROM public.forms WHERE id = p_form));
$$;

REVOKE ALL ON FUNCTION public.recruits_on(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recruits_on_form(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recruits_on(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recruits_on_form(UUID) TO authenticated;

-- Policies only add to the existing ones; nobody else's access changes.
DROP POLICY IF EXISTS "Recruitment reads its pipelines" ON public.pipelines;
CREATE POLICY "Recruitment reads its pipelines" ON public.pipelines FOR SELECT TO authenticated
  USING (public.recruits_on(id));

DROP POLICY IF EXISTS "Recruitment reads its stages" ON public.pipeline_stages;
CREATE POLICY "Recruitment reads its stages" ON public.pipeline_stages FOR SELECT TO authenticated
  USING (public.recruits_on(pipeline_id));

DROP POLICY IF EXISTS "Recruitment reads its entries" ON public.pipeline_entries;
CREATE POLICY "Recruitment reads its entries" ON public.pipeline_entries FOR SELECT TO authenticated
  USING (public.recruits_on(pipeline_id));

-- Moving an entry. The check keeps it on a recruitment pipeline.
DROP POLICY IF EXISTS "Recruitment moves its entries" ON public.pipeline_entries;
CREATE POLICY "Recruitment moves its entries" ON public.pipeline_entries FOR UPDATE TO authenticated
  USING (public.recruits_on(pipeline_id))
  WITH CHECK (public.recruits_on(pipeline_id));

DROP POLICY IF EXISTS "Recruitment reads entry answers" ON public.pipeline_entry_answers;
CREATE POLICY "Recruitment reads entry answers" ON public.pipeline_entry_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment reads entry assignees" ON public.pipeline_entry_assignees;
CREATE POLICY "Recruitment reads entry assignees" ON public.pipeline_entry_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment reads stage history" ON public.pipeline_entry_stage_history;
CREATE POLICY "Recruitment reads stage history" ON public.pipeline_entry_stage_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment records stage moves" ON public.pipeline_entry_stage_history;
CREATE POLICY "Recruitment records stage moves" ON public.pipeline_entry_stage_history FOR INSERT TO authenticated
  WITH CHECK (moved_by = auth.uid() AND EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment reads stage questions" ON public.pipeline_stage_questions;
CREATE POLICY "Recruitment reads stage questions" ON public.pipeline_stage_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = stage_id AND public.recruits_on(s.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment reads stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "Recruitment reads stage answers" ON public.pipeline_entry_stage_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment adds stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "Recruitment adds stage answers" ON public.pipeline_entry_stage_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

DROP POLICY IF EXISTS "Recruitment updates stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "Recruitment updates stage answers" ON public.pipeline_entry_stage_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id AND public.recruits_on(pe.pipeline_id)));

-- The form's name, its questions (for the order of the answers) and which link it came through.
DROP POLICY IF EXISTS "Recruitment reads its forms" ON public.forms;
CREATE POLICY "Recruitment reads its forms" ON public.forms FOR SELECT TO authenticated
  USING (public.recruits_on(pipeline_id));

DROP POLICY IF EXISTS "Recruitment reads form questions" ON public.form_nodes;
CREATE POLICY "Recruitment reads form questions" ON public.form_nodes FOR SELECT TO authenticated
  USING (public.recruits_on_form(form_id));

DROP POLICY IF EXISTS "Recruitment reads form links" ON public.form_links;
CREATE POLICY "Recruitment reads form links" ON public.form_links FOR SELECT TO authenticated
  USING (public.recruits_on_form(form_id));

-- ─── Automatic tasks can be addressed to them ────────────────────────────────
ALTER TABLE public.pipeline_stage_tasks DROP CONSTRAINT IF EXISTS pipeline_stage_tasks_assign_to_check;
ALTER TABLE public.pipeline_stage_tasks ADD CONSTRAINT pipeline_stage_tasks_assign_to_check
  CHECK (assign_to IN ('assignees', 'mover', 'user', 'investor_relations', 'recruitment'));

-- 20261127000000 unchanged, apart from recruitment beside investor_relations.
CREATE OR REPLACE FUNCTION public.raise_stage_tasks(p_entry UUID, p_stage UUID, p_mover UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e RECORD;
  t RECORD;
  v_title TEXT;
  v_targets UUID[];
  v_target UUID;
  v_task UUID;
  v_assign BOOLEAN;
BEGIN
  SELECT pe.id, coalesce(nullif(trim(pe.title), ''), 'Untitled entry') AS title, pe.company_id,
         pl.id AS pipeline_id, pl.org_id, pl.name AS pipeline_name, st.name AS stage_name
    INTO e
    FROM public.pipeline_entries pe
    JOIN public.pipelines pl ON pl.id = pe.pipeline_id
    LEFT JOIN public.pipeline_stages st ON st.id = p_stage
   WHERE pe.id = p_entry;
  IF NOT FOUND THEN RETURN; END IF;

  -- The stage it left is behind it: its open tasks are done.
  UPDATE public.tasks
     SET status = 'Done', completed_at = NOW()
   WHERE pipeline_entry_id = p_entry AND source = 'pipeline' AND status <> 'Done'
     AND (stage_task_id IS NULL
          OR stage_task_id NOT IN (SELECT id FROM public.pipeline_stage_tasks WHERE stage_id = p_stage));

  IF p_stage IS NULL THEN RETURN; END IF;

  -- Decided before any task is raised, so with several holders they are all added.
  v_assign := public.is_website_pipeline(e.pipeline_id)
    AND NOT EXISTS (SELECT 1 FROM public.pipeline_entry_assignees WHERE entry_id = p_entry);

  FOR t IN SELECT * FROM public.pipeline_stage_tasks WHERE stage_id = p_stage ORDER BY position, created_at LOOP
    v_title := CASE WHEN t.title LIKE '%{name}%' THEN replace(t.title, '{name}', e.title)
                    ELSE format('%s: %s', e.title, t.title) END;

    IF t.assign_to = 'user' THEN
      v_targets := ARRAY[t.user_id];
    ELSIF t.assign_to = 'investor_relations' THEN
      -- Nobody flagged: the task waits unassigned, and whoever is flagged next picks it up (below).
      SELECT array_agg(u.id) INTO v_targets
        FROM public.users u
       WHERE u.org_id = e.org_id AND u.is_investor_relations AND u.role <> 'franchise_partner';
      IF v_targets IS NULL THEN v_targets := ARRAY[NULL::UUID]; END IF;
    ELSIF t.assign_to = 'recruitment' THEN
      -- The same, for whoever is flagged for recruitment.
      SELECT array_agg(u.id) INTO v_targets
        FROM public.users u
       WHERE u.org_id = e.org_id AND u.is_recruitment AND u.role <> 'franchise_partner';
      IF v_targets IS NULL THEN v_targets := ARRAY[NULL::UUID]; END IF;
    ELSIF t.assign_to = 'mover' AND p_mover IS NOT NULL THEN
      v_targets := ARRAY[p_mover];
    ELSE
      SELECT array_agg(user_id) INTO v_targets FROM public.pipeline_entry_assignees WHERE entry_id = p_entry;
      IF v_targets IS NULL THEN v_targets := ARRAY[NULL::UUID]; END IF;
    END IF;

    FOREACH v_target IN ARRAY v_targets LOOP
      IF v_assign AND t.assign_to IN ('investor_relations', 'recruitment') AND v_target IS NOT NULL THEN
        INSERT INTO public.pipeline_entry_assignees (entry_id, user_id)
        SELECT p_entry, v_target
         WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_entry_assignees WHERE entry_id = p_entry AND user_id = v_target);
      END IF;

      -- One open copy per template per person: moving out and back in doesn't stack duplicates.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.tasks
         WHERE pipeline_entry_id = p_entry AND stage_task_id = t.id AND status <> 'Done'
           AND assignee_id IS NOT DISTINCT FROM v_target
      );
      INSERT INTO public.tasks (org_id, title, description, status, priority, due_date, assignee_id,
                               company_id, link_url, source, pipeline_entry_id, stage_task_id)
      VALUES (e.org_id, v_title,
              format('Raised automatically when %s entered %s on %s.', e.title, coalesce(e.stage_name, 'a stage'), e.pipeline_name),
              'To Do', t.priority::task_priority, (NOW() + make_interval(days => t.due_days))::DATE, v_target,
              e.company_id, format('/pipelines/%s', e.pipeline_id), 'pipeline', p_entry, t.id)
      RETURNING id INTO v_task;

      -- An application arrives with nobody around to mention it. Telling them must never undo the task.
      IF t.assign_to IN ('investor_relations', 'recruitment') AND v_target IS NOT NULL AND v_target IS DISTINCT FROM p_mover THEN
        BEGIN
          INSERT INTO public.notifications (org_id, user_id, actor_id, kind, title, body, link)
          VALUES (e.org_id, v_target, p_mover, 'task_assigned', v_title, 'Assigned to you', '/tasks?open=' || v_task);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'application task notification failed: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.raise_stage_tasks(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Somebody newly flagged picks up the waiting tasks and the entries they are about.
CREATE OR REPLACE FUNCTION public.claim_recruitment_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH claimed AS (
    UPDATE public.tasks x
       SET assignee_id = NEW.id
      FROM public.pipeline_stage_tasks st
     WHERE x.stage_task_id = st.id AND st.assign_to = 'recruitment'
       AND x.org_id = NEW.org_id AND x.assignee_id IS NULL AND x.source = 'pipeline' AND x.status <> 'Done'
    RETURNING x.pipeline_entry_id
  )
  INSERT INTO public.pipeline_entry_assignees (entry_id, user_id)
  SELECT DISTINCT c.pipeline_entry_id, NEW.id
    FROM claimed c
    JOIN public.pipeline_entries e ON e.id = c.pipeline_entry_id
   WHERE public.is_website_pipeline(e.pipeline_id)
     AND NOT EXISTS (SELECT 1 FROM public.pipeline_entry_assignees a WHERE a.entry_id = e.id);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.claim_recruitment_tasks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_claim_recruitment_tasks ON public.users;
CREATE TRIGGER users_claim_recruitment_tasks
  AFTER UPDATE OF is_recruitment ON public.users
  FOR EACH ROW WHEN (NEW.is_recruitment AND NOT OLD.is_recruitment)
  EXECUTE FUNCTION public.claim_recruitment_tasks();

-- The task itself. Editable on the board (stage ⚙ → Automatic tasks).
INSERT INTO public.pipeline_stage_tasks (stage_id, org_id, title, assign_to, due_days, priority, position)
SELECT s.id, p.org_id, 'Review {name}''s internship application', 'recruitment', 2, 'Medium', 0
  FROM public.form_links fl
  JOIN public.forms f ON f.id = fl.form_id AND f.is_website_form
  JOIN public.pipelines p ON p.id = f.pipeline_id
  JOIN public.pipeline_stages s ON s.pipeline_id = p.id AND s.stage_type = 'lead'
 WHERE fl.slug = 'intern'
   AND NOT EXISTS (SELECT 1 FROM public.pipeline_stage_tasks x WHERE x.stage_id = s.id AND x.assign_to = 'recruitment');

-- ─── An ending that turns somebody away, in the form's own words ─────────────
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS rejected_message TEXT;
COMMENT ON COLUMN public.forms.rejected_message IS
  'Shown at a Not Eligible ending, instead of the standard sentence. Blank lines separate paragraphs.';

-- 20261126000000 unchanged, apart from rejected_message.
CREATE OR REPLACE FUNCTION public.get_public_form(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT to_jsonb(public.get_form_for_submission(p_token)) AS j
  )
  SELECT
    CASE
      WHEN jsonb_typeof(j) IS DISTINCT FROM 'object' THEN j
      ELSE
        j
        || COALESCE((
             SELECT jsonb_build_object(
                      'form_display_name', f.display_name,
                      'website_form', f.is_website_form,
                      'success_message', f.success_message,
                      'rejected_message', f.rejected_message)
               FROM public.form_links fl
               JOIN public.forms f ON f.id = fl.form_id
              WHERE fl.token = p_token
           ), '{}'::jsonb)
        || CASE WHEN jsonb_typeof(j -> 'nodes') = 'array' THEN
             jsonb_build_object('nodes', COALESCE((
               SELECT jsonb_agg(
                        n || COALESCE((
                          SELECT jsonb_build_object('contact_field', fn.contact_field, 'field_key', fn.field_key)
                            FROM public.form_nodes fn
                           WHERE fn.id = (n ->> 'id')::UUID
                        ), '{}'::jsonb)
                        ORDER BY ord
                      )
                 FROM jsonb_array_elements(j -> 'nodes') WITH ORDINALITY AS t(n, ord)
             ), '[]'::jsonb))
           ELSE '{}'::jsonb END
    END
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_form(TEXT) TO anon, authenticated;

-- 20261126000000 unchanged, apart from refusing a Not Eligible ending.
CREATE OR REPLACE FUNCTION public.submit_website_form(p_link_id UUID, p_form_id UUID, p_pipeline_id UUID, p_answers JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry   UUID := gen_random_uuid();
  v_org     UUID;
  v_stage   UUID;
  v_form    TEXT;
  v_cur     UUID;
  v_next    UUID;
  v_node    RECORD;
  v_text    TEXT;
  v_opt     RECORD;
  v_name    TEXT;
  v_email   TEXT;
  v_digits  TEXT;
  v_flags   TEXT[] := '{}';
  v_nodes   UUID[] := '{}';
  v_texts   TEXT[] := '{}';
BEGIN
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers) > 100 THEN
    RAISE EXCEPTION 'Answers missing' USING ERRCODE = '22023';
  END IF;

  SELECT p.org_id INTO v_org FROM public.pipelines p WHERE p.id = p_pipeline_id;
  SELECT coalesce(display_name, title) INTO v_form FROM public.forms WHERE id = p_form_id;
  SELECT s.id INTO v_stage FROM public.pipeline_stages s
   WHERE s.pipeline_id = p_pipeline_id AND s.stage_type = 'lead' ORDER BY s.position LIMIT 1;

  SELECT e.target_node_id INTO v_cur
    FROM public.form_nodes n JOIN public.form_edges e ON e.source_node_id = n.id
   WHERE n.form_id = p_form_id AND n.type = 'start' LIMIT 1;

  FOR i IN 1..200 LOOP
    SELECT n.id, n.type, n.subtype, n.answer_type, n.contact_field INTO v_node
      FROM public.form_nodes n WHERE n.id = v_cur AND n.form_id = p_form_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Form path broken' USING ERRCODE = '22023'; END IF;
    EXIT WHEN v_node.type = 'end';

    SELECT trim(a ->> 'answer_text') INTO v_text
      FROM jsonb_array_elements(p_answers) AS a WHERE a ->> 'node_id' = v_node.id::TEXT LIMIT 1;
    IF coalesce(v_text, '') = '' OR length(v_text) > 5000 THEN
      RAISE EXCEPTION 'Answer missing or too long' USING ERRCODE = '22023';
    END IF;

    v_next := NULL;
    IF v_node.answer_type = 'mcq' THEN
      SELECT o.id, o.flag INTO v_opt
        FROM public.form_node_options o WHERE o.node_id = v_node.id AND o.label = v_text LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'Not one of the options' USING ERRCODE = '22023'; END IF;
      IF v_opt.flag IS NOT NULL THEN v_flags := array_append(v_flags, v_opt.flag); END IF;
      SELECT e.target_node_id INTO v_next FROM public.form_edges e
       WHERE e.source_node_id = v_node.id AND e.condition_value = v_opt.id::TEXT LIMIT 1;
    END IF;
    IF v_next IS NULL THEN
      SELECT e.target_node_id INTO v_next FROM public.form_edges e
       WHERE e.source_node_id = v_node.id AND e.condition_value IS NULL LIMIT 1;
    END IF;

    IF v_node.contact_field = 'name' THEN
      v_name := left(v_text, 200);
    ELSIF v_node.contact_field = 'email' THEN
      IF length(v_text) > 254 OR v_text !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
        RAISE EXCEPTION 'Email not valid' USING ERRCODE = '22023';
      END IF;
      v_email := v_text;
    ELSIF v_node.contact_field = 'phone' THEN
      v_digits := regexp_replace(v_text, '\D', '', 'g');
      IF length(v_digits) NOT BETWEEN 8 AND 17 THEN
        RAISE EXCEPTION 'Phone not valid' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_nodes := array_append(v_nodes, v_node.id);
    v_texts := array_append(v_texts, v_text);
    v_cur := v_next;
  END LOOP;
  IF v_node.type IS DISTINCT FROM 'end' THEN RAISE EXCEPTION 'Form path broken' USING ERRCODE = '22023'; END IF;
  -- An ending that turns them away has nothing to submit. The page offers no way to; this refuses any other.
  IF v_node.subtype = 'rejected' THEN RAISE EXCEPTION 'Not eligible' USING ERRCODE = '22023'; END IF;

  -- There is no contact record in the app: submissions from one person are tied by their email. Both
  -- are kept, and the later one says so.
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pipeline_entries e
      JOIN public.forms f ON f.id = e.form_id
     WHERE f.is_website_form AND f.org_id = v_org AND lower(e.submitter_email) = lower(v_email)
  ) THEN
    v_flags := array_append(v_flags, 'Applied before');
  END IF;

  INSERT INTO public.pipeline_entries (id, pipeline_id, form_id, form_link_id, stage_id, title, submitter_name, submitter_email, flags)
  VALUES (v_entry, p_pipeline_id, p_form_id, p_link_id, v_stage, left(coalesce(v_name, 'Application'), 120), v_name, v_email, v_flags);

  -- The question's wording is copied onto each answer by trigger (20261016000000), which with
  -- submitted_at is the record of what was consented to and when.
  INSERT INTO public.pipeline_entry_answers (entry_id, node_id, answer_text)
  SELECT v_entry, u.n, u.t FROM unnest(v_nodes, v_texts) AS u(n, t);

  -- Telling the team must never lose the application.
  BEGIN
    INSERT INTO public.notifications (org_id, user_id, kind, title, body, link)
    SELECT v_org, u.id, 'form_submitted', 'New ' || v_form,
           coalesce(v_name, 'Someone') || ' applied on the website.'
             || CASE WHEN cardinality(v_flags) > 0 THEN ' ' || array_to_string(v_flags, '. ') || '.' ELSE '' END,
           '/pipelines/' || p_pipeline_id
      FROM public.users u
     WHERE u.org_id = v_org AND u.role IN ('founder', 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'website form notification failed: %', SQLERRM;
  END;

  RETURN v_entry;
END $$;

REVOKE ALL ON FUNCTION public.submit_website_form(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ─── Under 18 ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_form UUID; v_node UUID; v_no UUID; v_end UUID; v_x FLOAT; v_y FLOAT;
BEGIN
  SELECT fl.form_id INTO v_form FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
   WHERE fl.slug = 'intern' AND f.is_website_form;
  SELECT n.id, n.position_x, n.position_y, o.id INTO v_node, v_x, v_y, v_no
    FROM public.form_nodes n JOIN public.form_node_options o ON o.node_id = n.id AND o.label = 'No'
   WHERE n.form_id = v_form AND n.field_key = 'age_18';
  IF v_no IS NULL THEN
    RAISE EXCEPTION 'The age question, or its "No" option, is not on the internship form. Nothing was changed.';
  END IF;

  UPDATE public.forms SET rejected_message =
    E'Our form is for people aged 18 or over. If you are younger, please ask a parent or guardian to email us at info@earlyseedventures.com.\n\nWe have not saved any of your answers.'
   WHERE id = v_form AND rejected_message IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.form_edges e JOIN public.form_nodes t ON t.id = e.target_node_id
     WHERE e.source_node_id = v_node AND e.condition_value = v_no::TEXT AND t.type = 'end' AND t.subtype = 'rejected'
  ) THEN
    DELETE FROM public.form_edges WHERE source_node_id = v_node AND condition_value = v_no::TEXT;
    INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
    VALUES (v_form, 'end', 'rejected', NULL, '', v_x + 442, v_y + 60) RETURNING id INTO v_end;
    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id, condition_value, condition_label)
    VALUES (v_form, v_node, v_end, v_no::TEXT, 'No');
  END IF;
  -- Nobody who answers "No" can submit, so there is nothing left to flag.
  UPDATE public.form_node_options SET flag = NULL WHERE id = v_no;
END $$;

-- What it did: expect one row, "No" leading to rejected, one recruitment task, recruitment pipeline true.
SELECT f.title AS form, f.published, p.name AS pipeline, p.is_recruitment,
       (SELECT t.subtype FROM public.form_nodes n
          JOIN public.form_node_options o ON o.node_id = n.id AND o.label = 'No'
          JOIN public.form_edges e ON e.source_node_id = n.id AND e.condition_value = o.id::TEXT
          JOIN public.form_nodes t ON t.id = e.target_node_id
         WHERE n.form_id = f.id AND n.field_key = 'age_18') AS under_18_leads_to,
       (SELECT count(*) FROM public.pipeline_stage_tasks x JOIN public.pipeline_stages s ON s.id = x.stage_id
         WHERE s.pipeline_id = p.id AND x.assign_to = 'recruitment') AS recruitment_tasks
  FROM public.form_links fl
  JOIN public.forms f ON f.id = fl.form_id
  JOIN public.pipelines p ON p.id = f.pipeline_id
 WHERE fl.slug = 'intern';
