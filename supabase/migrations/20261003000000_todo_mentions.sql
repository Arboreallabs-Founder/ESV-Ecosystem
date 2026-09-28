-- @mentions on personal to-do sub-tasks.
--
-- Personal to-dos are private by design (see 20260728000000 and the visibility note in
-- 20261002000000) — the whole point of the list is that it isn't a shared board. A mention is a
-- narrow, deliberate crack in that: when you type "@Name" into a sub-task, that one person gets a
-- notification and can read that one row, on their own to-do page, read-only. Nothing else about
-- your list opens up. The mentioned row's parent, siblings, and the rest of your board stay
-- exactly as private as they were.

CREATE TABLE IF NOT EXISTS public.personal_todo_mentions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID NOT NULL REFERENCES public.personal_todos(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES public.organizations(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (todo_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_personal_todo_mentions_user ON public.personal_todo_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_personal_todo_mentions_todo ON public.personal_todo_mentions(todo_id);

ALTER TABLE public.personal_todo_mentions ENABLE ROW LEVEL SECURITY;

-- Only the todo's owner can create a mention on it. The EXISTS subquery reads personal_todos under
-- the caller's own RLS (not a different table's policy re-entering itself, so no SECURITY DEFINER
-- needed here) — it passes because an owner can always see their own row.
DROP POLICY IF EXISTS "Owner adds mentions on own todo" ON public.personal_todo_mentions;
CREATE POLICY "Owner adds mentions on own todo"
  ON public.personal_todo_mentions FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND EXISTS (SELECT 1 FROM public.personal_todos t WHERE t.id = todo_id AND t.user_id = auth.uid())
  );

-- Readable by whoever it's about: the person tagged, or the list owner who tagged them.
DROP POLICY IF EXISTS "Read visible mentions" ON public.personal_todo_mentions;
CREATE POLICY "Read visible mentions"
  ON public.personal_todo_mentions FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR mentioned_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.personal_todos t WHERE t.id = todo_id AND t.user_id = auth.uid())
  );

-- The mentioned person's read into personal_todos itself: exactly the one row they were tagged on,
-- nothing else on that list. Queries a different table (personal_todo_mentions), so — same
-- reasoning as todo_parent_is_shared() in 20261002000000 — this does not re-enter personal_todos'
-- own RLS and needs no SECURITY DEFINER wrapper.
DROP POLICY IF EXISTS "Users read subtasks mentioning them" ON public.personal_todos;
CREATE POLICY "Users read subtasks mentioning them"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.personal_todo_mentions m
      WHERE m.todo_id = id AND m.mentioned_user_id = auth.uid()
    )
  );

-- New notification kind. TEXT + CHECK, not an enum, for the same reason 20260930000000 chose it:
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction that then uses the value.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'task_assigned', 'task_reassigned', 'task_comment',
  'leave_submitted', 'leave_decided',
  'expense_submitted', 'expense_decided',
  'kudos_received', 'escalation_raised', 'approval_recorded',
  'bulletin_posted', 'event_posted',
  'mention'
));
