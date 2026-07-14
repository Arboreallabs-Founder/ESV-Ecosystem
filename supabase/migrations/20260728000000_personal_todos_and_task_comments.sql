-- Personal to-do list (per user, own list, optionally linked to a shared Task with two-way
-- completion sync) + comment threads on Tasks.

-- ─── personal_todos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_todos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  title          TEXT NOT NULL,
  notes          TEXT,
  done           BOOLEAN NOT NULL DEFAULT false,
  done_at        TIMESTAMPTZ,
  due_date       DATE,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_todos_user ON public.personal_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_todos_linked_task ON public.personal_todos(linked_task_id);
-- A user can only port a given task into their list once.
CREATE UNIQUE INDEX IF NOT EXISTS personal_todos_user_linked_task_uniq
  ON public.personal_todos(user_id, linked_task_id) WHERE linked_task_id IS NOT NULL;

ALTER TABLE public.personal_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own personal todos" ON public.personal_todos;
CREATE POLICY "Users manage own personal todos"
  ON public.personal_todos FOR ALL TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR (user_id = auth.uid() AND org_id = public.get_user_org_id()));

-- ─── task_comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  body       TEXT NOT NULL,
  author_id  UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Comment visibility/write access mirrors the parent task's own RLS: admins/founders see and
-- comment on any org task; associates only on tasks assigned to them.
DROP POLICY IF EXISTS "Task comments follow task visibility" ON public.task_comments;
CREATE POLICY "Task comments follow task visibility"
  ON public.task_comments FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR (
      org_id = public.get_user_org_id() AND (
        public.get_user_role() IN ('founder', 'admin')
        OR (
          public.get_user_role() = 'associate'
          AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      org_id = public.get_user_org_id() AND (
        public.get_user_role() IN ('founder', 'admin')
        OR (
          public.get_user_role() = 'associate'
          AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
        )
      )
    )
  );
