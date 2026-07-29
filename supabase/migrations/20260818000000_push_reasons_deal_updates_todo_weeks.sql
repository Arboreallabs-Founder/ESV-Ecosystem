-- Three additions:
--   1. task_pushes  — a log of every push with its reason and what blocked it. A log rather than
--      more columns on `tasks` because the whole point is the *history*: tasks.pushed_at/push_count
--      only ever describe the latest push, which can't answer "why do this person's tasks slip".
--   2. active_deal_updates — a timestamped update thread per active deal, surfaced as the deal's
--      latest update in the weekly rollup.
--   3. personal_todos.work_week_start — which work week a to-do belongs to, independent of its due
--      date, so something can be parked in a week without inventing a hard deadline.

-- ─── task_pushes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_pushes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.organizations(id),
  task_id            UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  pushed_by          UUID NOT NULL REFERENCES public.users(id),
  from_date          DATE,
  to_date            DATE NOT NULL,
  reason             TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  blocked_external   BOOLEAN NOT NULL DEFAULT false,
  -- Single person, deliberately: "X was blocked by Y N times" stays unambiguous in the KPI.
  blocked_by_user_id UUID REFERENCES public.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_pushes_org ON public.task_pushes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_pushes_task ON public.task_pushes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_pushes_pusher ON public.task_pushes(pushed_by);

ALTER TABLE public.task_pushes ENABLE ROW LEVEL SECURITY;

-- Mirrors task visibility: leaders see the org, everyone else sees pushes on their own tasks.
DROP POLICY IF EXISTS "Task pushes select" ON public.task_pushes;
CREATE POLICY "Task pushes select" ON public.task_pushes
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR pushed_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Task pushes insert" ON public.task_pushes;
CREATE POLICY "Task pushes insert" ON public.task_pushes
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND pushed_by = auth.uid()
  );

-- ─── active_deal_updates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.active_deal_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,
  body           TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_by     UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_updates_deal ON public.active_deal_updates(active_deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_updates_org ON public.active_deal_updates(org_id);

ALTER TABLE public.active_deal_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deal updates select" ON public.active_deal_updates;
CREATE POLICY "Deal updates select" ON public.active_deal_updates
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr'))
  );

-- Posting is for the deal's POCs — the assignees on its pipeline entry — plus founder/admin.
DROP POLICY IF EXISTS "Deal updates insert" ON public.active_deal_updates;
CREATE POLICY "Deal updates insert" ON public.active_deal_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND created_by = auth.uid()
    AND (
      public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.active_deals ad
        JOIN public.pipeline_entry_assignees pea ON pea.entry_id = ad.pipeline_entry_id
        WHERE ad.id = active_deal_id AND pea.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Deal updates delete" ON public.active_deal_updates;
CREATE POLICY "Deal updates delete" ON public.active_deal_updates
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder', 'admin') OR created_by = auth.uid())
    )
  );

-- ─── personal_todos work week ───────────────────────────────────────────────
-- Monday of the week the to-do belongs to. Separate from due_date on purpose: you can park an
-- item in a week without committing to a deadline for it.
ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS work_week_start DATE;

CREATE INDEX IF NOT EXISTS idx_personal_todos_week ON public.personal_todos(user_id, work_week_start);

-- Personal to-dos are otherwise strictly private (the existing FOR ALL policy is user_id-scoped),
-- and they should stay that way. But an item put into a work week is being deliberately submitted
-- to that week's update — so assigning a week IS the opt-in, and only then can leadership read it.
-- Anything with a NULL work_week_start remains invisible to everyone but its owner.
DROP POLICY IF EXISTS "Leads read week-assigned personal todos" ON public.personal_todos;
CREATE POLICY "Leads read week-assigned personal todos"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    work_week_start IS NOT NULL
    AND org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin')
  );
