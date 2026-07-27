-- 'hr' gets full task read/write parity with 'general' (same self-scoping to
-- assignee_id = auth.uid()). Mirrors 20260805100000_general_role_rls.sql's tasks section —
-- 'general' is untouched, 'hr' is added alongside it everywhere it appears.

DROP POLICY IF EXISTS "Associates view own tasks" ON public.tasks;
CREATE POLICY "Associates view own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Associates create tasks" ON public.tasks;
CREATE POLICY "Associates create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND created_by = auth.uid()
    AND (
      assignee_id = auth.uid()
      OR (SELECT role FROM public.users WHERE id = assignee_id) IN ('associate', 'general', 'hr')
    )
  );

DROP POLICY IF EXISTS "Associates update own tasks" ON public.tasks;
CREATE POLICY "Associates update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND assignee_id = auth.uid()
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Task comments follow task visibility" ON public.task_comments;
CREATE POLICY "Task comments follow task visibility"
  ON public.task_comments FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR (
      org_id = public.get_user_org_id() AND (
        public.get_user_role() IN ('founder', 'admin')
        OR (
          public.get_user_role() IN ('associate', 'general', 'hr')
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
          public.get_user_role() IN ('associate', 'general', 'hr')
          AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
        )
      )
    )
  );

-- Recurring tasks: 'general's policies use single-role equality checks, not IN-lists, so add
-- parallel 'hr' policies rather than rewriting them (purely additive, nothing touched).
DROP POLICY IF EXISTS "HR view recurring tasks" ON public.recurring_tasks;
CREATE POLICY "HR view recurring tasks"
  ON public.recurring_tasks FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'hr');

DROP POLICY IF EXISTS "HR update recurring tasks" ON public.recurring_tasks;
CREATE POLICY "HR update recurring tasks"
  ON public.recurring_tasks FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'hr')
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() = 'hr');

DROP POLICY IF EXISTS "HR view completions" ON public.recurring_task_completions;
CREATE POLICY "HR view completions"
  ON public.recurring_task_completions FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'hr');

DROP POLICY IF EXISTS "HR insert completions" ON public.recurring_task_completions;
CREATE POLICY "HR insert completions"
  ON public.recurring_task_completions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() = 'hr');
