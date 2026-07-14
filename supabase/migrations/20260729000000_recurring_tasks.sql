-- Recurring admin tasks (e.g. "fill the weekly self-reflection form every Saturday") with a
-- shared tick-off per occurrence. A task only shows up `lead_days` before its next_due_date; if
-- it's missed, next_due_date is left untouched so it stays visible as overdue indefinitely —
-- it only advances to the next occurrence once someone ticks it off.

DO $$ BEGIN CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id),
  title           TEXT NOT NULL,
  description     TEXT,
  link_url        TEXT,
  recurrence_type recurrence_type NOT NULL DEFAULT 'weekly',
  lead_days       INTEGER NOT NULL DEFAULT 2,
  assignee_id     UUID REFERENCES public.users(id),
  active          BOOLEAN NOT NULL DEFAULT true,
  next_due_date   DATE NOT NULL,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_tasks_org ON public.recurring_tasks(org_id);

-- One completion row per occurrence — also gives an audit trail of who did it and when.
CREATE TABLE IF NOT EXISTS public.recurring_task_completions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id  UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  org_id             UUID NOT NULL REFERENCES public.organizations(id),
  occurrence_date    DATE NOT NULL,
  completed_by       UUID REFERENCES public.users(id),
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_task_completions_uniq ON public.recurring_task_completions(recurring_task_id, occurrence_date);
CREATE INDEX IF NOT EXISTS idx_recurring_task_completions_task ON public.recurring_task_completions(recurring_task_id);

ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;

-- recurring_tasks: founder/admin/associate can all view and tick off (UPDATE advances
-- next_due_date on completion); only founder/admin define or delete the recurring task itself.
DROP POLICY IF EXISTS "Internal view recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Internal view recurring tasks"
  ON public.recurring_tasks FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Admins create recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Admins create recurring tasks"
  ON public.recurring_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Internal update recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Internal update recurring tasks"
  ON public.recurring_tasks FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Admins delete recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Admins delete recurring tasks"
  ON public.recurring_tasks FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

-- recurring_task_completions: internal roles view + tick off; only founder/admin can delete
-- (correcting a mistaken tick).
DROP POLICY IF EXISTS "Internal view completions" ON public.recurring_task_completions;
CREATE POLICY "Internal view completions"
  ON public.recurring_task_completions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Internal insert completions" ON public.recurring_task_completions;
CREATE POLICY "Internal insert completions"
  ON public.recurring_task_completions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Admins delete completions" ON public.recurring_task_completions;
CREATE POLICY "Admins delete completions"
  ON public.recurring_task_completions FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));
