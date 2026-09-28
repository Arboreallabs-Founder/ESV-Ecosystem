-- Fixes infinite recursion introduced by 20261003000000's mention-visibility policy.
--
-- "Users read subtasks mentioning them" (on personal_todos) checked EXISTS against
-- personal_todo_mentions inline. But personal_todo_mentions' own SELECT policy, "Read visible
-- mentions", checks EXISTS against personal_todos right back. Postgres evaluates every permissive
-- policy on a table for every SELECT against it, so ANY query against personal_todos — including
-- an owner reading their own list — now walks personal_todos -> personal_todo_mentions ->
-- personal_todos and Postgres aborts with "infinite recursion detected in policy". The app's
-- getMyTodos() only reads the data field, not error, so that failure renders as a silently empty
-- to-do list rather than a visible error. Nothing was deleted; the read was breaking.
--
-- This is the indirect version of the exact bug todo_parent_is_shared() exists to prevent
-- (20261002000000, documented in docs/MIGRATIONS.md) — that one guarded against a table's policy
-- querying itself; this is two tables' policies querying each other. Same fix: a SECURITY DEFINER
-- function ends the cycle by reading personal_todo_mentions outside RLS instead of through it.

CREATE OR REPLACE FUNCTION public.todo_is_mentioned_for_current_user(p_todo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_todo_mentions m
    WHERE m.todo_id = p_todo_id AND m.mentioned_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.todo_is_mentioned_for_current_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.todo_is_mentioned_for_current_user(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users read subtasks mentioning them" ON public.personal_todos;
CREATE POLICY "Users read subtasks mentioning them"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.todo_is_mentioned_for_current_user(id)
  );
