-- Investor Relations are assigned to website applications, not only given the task.
--
-- An entry can't be moved until somebody is assigned to it, so an application arrived with a task for
-- investor relations that they first had to assign themselves to act on.
--
-- Only on pipelines fed by a website form: an investor relations task on a deal pipeline's stage should
-- not quietly add people to the deal. Only when nobody is assigned: an entry handed to somebody else and
-- later moved back to "New application" stays theirs.

CREATE OR REPLACE FUNCTION public.is_website_pipeline(p_pipeline UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.forms WHERE pipeline_id = p_pipeline AND is_website_form);
$$;

REVOKE ALL ON FUNCTION public.is_website_pipeline(UUID) FROM PUBLIC, anon, authenticated;

-- 20261126000100 unchanged, apart from v_assign.
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
    ELSIF t.assign_to = 'mover' AND p_mover IS NOT NULL THEN
      v_targets := ARRAY[p_mover];
    ELSE
      SELECT array_agg(user_id) INTO v_targets FROM public.pipeline_entry_assignees WHERE entry_id = p_entry;
      IF v_targets IS NULL THEN v_targets := ARRAY[NULL::UUID]; END IF;
    END IF;

    FOREACH v_target IN ARRAY v_targets LOOP
      IF v_assign AND t.assign_to = 'investor_relations' AND v_target IS NOT NULL THEN
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
      IF t.assign_to = 'investor_relations' AND v_target IS NOT NULL AND v_target IS DISTINCT FROM p_mover THEN
        BEGIN
          INSERT INTO public.notifications (org_id, user_id, actor_id, kind, title, body, link)
          VALUES (e.org_id, v_target, p_mover, 'task_assigned', v_title, 'Assigned to you', '/tasks?open=' || v_task);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'investor relations task notification failed: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.raise_stage_tasks(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Somebody newly flagged picks up the waiting tasks, as before, and the entries they are about.
CREATE OR REPLACE FUNCTION public.claim_investor_relations_tasks()
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
     WHERE x.stage_task_id = st.id AND st.assign_to = 'investor_relations'
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

REVOKE ALL ON FUNCTION public.claim_investor_relations_tasks() FROM PUBLIC, anon, authenticated;

-- Applications that arrived before this ran: whoever holds their open task.
INSERT INTO public.pipeline_entry_assignees (entry_id, user_id)
SELECT DISTINCT x.pipeline_entry_id, x.assignee_id
  FROM public.tasks x
  JOIN public.pipeline_stage_tasks st ON st.id = x.stage_task_id AND st.assign_to = 'investor_relations'
  JOIN public.pipeline_entries e ON e.id = x.pipeline_entry_id
 WHERE x.assignee_id IS NOT NULL AND x.source = 'pipeline' AND x.status <> 'Done'
   AND public.is_website_pipeline(e.pipeline_id)
   AND NOT EXISTS (SELECT 1 FROM public.pipeline_entry_assignees a WHERE a.entry_id = e.id);
