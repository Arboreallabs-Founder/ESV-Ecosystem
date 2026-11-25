-- Investor Relations: whoever is flagged gets a task for every new website application.
--
-- Run 20261126000000_website_forms.sql first.
--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'forms' AND column_name = 'is_website_form'
  ) THEN
    RAISE EXCEPTION 'Run 20261126000000_website_forms.sql first.';
  END IF;
END $$;

-- ─── The flag ────────────────────────────────────────────────────────────────
-- A flag on the person, set in Admin > Users, like is_sgp_coordinator and is_general_lead: handing
-- investor relations to somebody else is a tick, not an edit to every pipeline that names them. It
-- grants no access to anything; it only says who these tasks go to.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_investor_relations BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.users.is_investor_relations IS
  'Investor Relations: gets the automatic pipeline tasks addressed to investor relations, starting with every new website application. Set by founder/admin in Admin > Users.';

-- ─── Automatic tasks can be addressed to them ────────────────────────────────
-- A fourth choice beside assignees / mover / user (20261017000000), usable on any stage.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.pipeline_stage_tasks'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%assign_to%mover%'
  LOOP
    EXECUTE format('ALTER TABLE public.pipeline_stage_tasks DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.pipeline_stage_tasks ADD CONSTRAINT pipeline_stage_tasks_assign_to_check
  CHECK (assign_to IN ('assignees', 'mover', 'user', 'investor_relations'));

-- 20261017000000 unchanged, apart from the investor_relations branch and telling those people.
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

-- ─── Tasks that were waiting for somebody to be flagged ──────────────────────
CREATE OR REPLACE FUNCTION public.claim_investor_relations_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks x
     SET assignee_id = NEW.id
    FROM public.pipeline_stage_tasks st
   WHERE x.stage_task_id = st.id AND st.assign_to = 'investor_relations'
     AND x.org_id = NEW.org_id AND x.assignee_id IS NULL AND x.source = 'pipeline' AND x.status <> 'Done';
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.claim_investor_relations_tasks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_claim_investor_relations_tasks ON public.users;
CREATE TRIGGER users_claim_investor_relations_tasks
  AFTER UPDATE OF is_investor_relations ON public.users
  FOR EACH ROW WHEN (NEW.is_investor_relations AND NOT OLD.is_investor_relations)
  EXECUTE FUNCTION public.claim_investor_relations_tasks();

-- ─── The task itself ─────────────────────────────────────────────────────────
-- On the first stage of both website pipelines. Editable on the board (stage ⚙ → Automatic tasks).
-- Run again, this only adds it where a stage has no investor relations task.
INSERT INTO public.pipeline_stage_tasks (stage_id, org_id, title, assign_to, due_days, priority, position)
SELECT s.id, p.org_id,
       CASE fl.slug WHEN 'syndicate' THEN 'Contact {name} about their syndicate application'
                    ELSE 'Contact {name} about their growth partner application' END,
       'investor_relations', 2, 'Medium', 0
  FROM public.form_links fl
  JOIN public.forms f ON f.id = fl.form_id AND f.is_website_form
  JOIN public.pipelines p ON p.id = f.pipeline_id
  JOIN public.pipeline_stages s ON s.pipeline_id = p.id AND s.stage_type = 'lead'
 WHERE fl.is_general
   AND NOT EXISTS (SELECT 1 FROM public.pipeline_stage_tasks x WHERE x.stage_id = s.id AND x.assign_to = 'investor_relations');
