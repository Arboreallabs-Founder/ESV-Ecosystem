-- ─── 1. Add founder contact fields to deals ──────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS founder_name TEXT,
  ADD COLUMN IF NOT EXISTS founder_email TEXT;

-- ─── 2. Tasks table ───────────────────────────────────────────────────────────
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done');

CREATE TABLE public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.users(id),
  deal_id     UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  due_date    DATE,
  priority    task_priority NOT NULL DEFAULT 'Medium',
  status      task_status NOT NULL DEFAULT 'To Do',
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks RLS: internal users manage tasks; franchise_partners see only tasks on their deals
CREATE POLICY "Internal users can view all tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('founder', 'admin', 'associate'));

CREATE POLICY "Internal users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('founder', 'admin', 'associate'));
