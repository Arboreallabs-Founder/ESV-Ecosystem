-- Automatic tasks on pipeline stages.
--
-- Each stage (Lead, Accepted and Rejected included) can carry task templates. When an entry enters
-- the stage, however it gets there — dragged on the board, accepted, rejected, or submitted through
-- a form straight into the first stage — each template becomes a real task on the task board, and
-- the open tasks from the stage it left are closed. Stages stay freely addable and removable; the
-- templates go with their stage.
--
-- Who a template's task goes to:
--   assignees  everyone assigned to the entry, one copy each (as Projects do). While nobody is
--              assigned — a fresh form submission — the task waits unassigned, and whoever is
--              assigned first picks it up; later assignees get their own copy.
--   mover      whoever moved the entry into the stage (for a form submission there is nobody, so
--              it falls back to the entry's assignees).
--   user       one named person, whatever the entry.

CREATE TABLE IF NOT EXISTS public.pipeline_stage_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id   UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  -- "{name}" is replaced by the entry's title; without it, the title is prefixed with it.
  title      TEXT NOT NULL CHECK (length(trim(title)) > 0),
  assign_to  TEXT NOT NULL DEFAULT 'assignees' CHECK (assign_to IN ('assignees', 'mover', 'user')),
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_days   INT NOT NULL DEFAULT 2 CHECK (due_days BETWEEN 0 AND 365),
  priority   TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (assign_to <> 'user' OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_stage_tasks_stage ON public.pipeline_stage_tasks(stage_id);

ALTER TABLE public.pipeline_stage_tasks ENABLE ROW LEVEL SECURITY;

-- Same access as stage questions: internal roles in the pipeline's org (writes go through
-- founder/admin-only actions).
DROP POLICY IF EXISTS "Org internal stage tasks" ON public.pipeline_stage_tasks;
CREATE POLICY "Org internal stage tasks"
  ON public.pipeline_stage_tasks FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate', 'general')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_stages s
        JOIN public.pipelines p ON p.id = s.pipeline_id
        WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_stages s
        JOIN public.pipelines p ON p.id = s.pipeline_id
        WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
      )
    )
  );

-- ─── Tasks know where they came from ─────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.tasks'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%source%automatic%'
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_check
  CHECK (source IN ('manual', 'automatic', 'project', 'pipeline'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pipeline_entry_id UUID REFERENCES public.pipeline_entries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stage_task_id UUID REFERENCES public.pipeline_stage_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_pipeline_entry ON public.tasks(pipeline_entry_id) WHERE pipeline_entry_id IS NOT NULL;

-- ─── Raising them ────────────────────────────────────────────────────────────
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
              e.company_id, format('/pipelines/%s', e.pipeline_id), 'pipeline', p_entry, t.id);
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.raise_stage_tasks(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Every way an entry reaches a stage goes through here: board moves, accept/reject, and anonymous
-- form submissions (an insert straight into the first stage, with no mover).
CREATE OR REPLACE FUNCTION public.pipeline_entry_stage_tasks_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    PERFORM public.raise_stage_tasks(NEW.id, NEW.stage_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_entries_stage_tasks ON public.pipeline_entries;
CREATE TRIGGER pipeline_entries_stage_tasks
  AFTER INSERT OR UPDATE OF stage_id ON public.pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.pipeline_entry_stage_tasks_trigger();

-- ─── Assignees coming and going ──────────────────────────────────────────────
-- Someone assigned to the entry picks up its waiting unassigned task, or gets their own copy of
-- each "assignees" task for the current stage. Someone unassigned loses their open copies.
CREATE OR REPLACE FUNCTION public.pipeline_assignee_stage_tasks_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  v_stage UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tasks x
     USING public.pipeline_stage_tasks st
     WHERE x.stage_task_id = st.id AND st.assign_to IN ('assignees', 'mover')
       AND x.pipeline_entry_id = OLD.entry_id AND x.source = 'pipeline' AND x.status <> 'Done'
       AND x.assignee_id = OLD.user_id;
    RETURN OLD;
  END IF;

  SELECT stage_id INTO v_stage FROM public.pipeline_entries WHERE id = NEW.entry_id;
  IF v_stage IS NULL THEN RETURN NEW; END IF;

  FOR t IN
    SELECT st.* FROM public.pipeline_stage_tasks st WHERE st.stage_id = v_stage AND st.assign_to IN ('assignees', 'mover')
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.tasks x
       WHERE x.pipeline_entry_id = NEW.entry_id AND x.stage_task_id = t.id AND x.status <> 'Done'
         AND x.assignee_id = NEW.user_id
    );
    -- Claim the waiting unassigned copy if there is one…
    UPDATE public.tasks x SET assignee_id = NEW.user_id
     WHERE x.id = (
       SELECT id FROM public.tasks
        WHERE pipeline_entry_id = NEW.entry_id AND stage_task_id = t.id AND status <> 'Done' AND assignee_id IS NULL
        LIMIT 1
     );
    -- …otherwise take a copy of an existing one (only "assignees" tasks are shared out this way).
    IF NOT FOUND AND t.assign_to = 'assignees' THEN
      INSERT INTO public.tasks (org_id, title, description, status, priority, due_date, assignee_id,
                               company_id, link_url, source, pipeline_entry_id, stage_task_id)
      SELECT x.org_id, x.title, x.description, 'To Do', x.priority, x.due_date, NEW.user_id,
             x.company_id, x.link_url, 'pipeline', x.pipeline_entry_id, x.stage_task_id
        FROM public.tasks x
       WHERE x.pipeline_entry_id = NEW.entry_id AND x.stage_task_id = t.id AND x.status <> 'Done'
       LIMIT 1;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_entry_assignees_stage_tasks ON public.pipeline_entry_assignees;
CREATE TRIGGER pipeline_entry_assignees_stage_tasks
  AFTER INSERT OR DELETE ON public.pipeline_entry_assignees
  FOR EACH ROW EXECUTE FUNCTION public.pipeline_assignee_stage_tasks_trigger();
