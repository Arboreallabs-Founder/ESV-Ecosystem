-- An SGP coordinator could not hand a submission to anybody but themselves.
--
-- ─── The failure ────────────────────────────────────────────────────────────
-- Assigning from the Desk raised 42501, insufficient privilege, and the INSERT policy was not the
-- cause — it admits exactly the roles the dropdown offers. The refusal came from SELECT.
--
-- The action inserts with a RETURNING clause (`.insert(...).select('id')`), and Postgres checks the
-- SELECT policy on the row being returned. "Associates view own tasks" allows a row only where
-- assignee_id = auth.uid(). So an associate creating a task for a colleague passed the write and
-- was refused the read back of the row they had just written, and the whole statement failed.
--
-- Worth naming because the shape recurs: a policy set can permit a write and still fail it, if the
-- statement reads. Anywhere `.insert().select()` meets a SELECT policy narrower than the INSERT
-- one, the same thing happens.
--
-- ─── The fix ────────────────────────────────────────────────────────────────
-- You can see the work you assigned. That is not merely what unblocks the Desk; an associate who
-- hands a task to a colleague and then cannot find it anywhere is a gap in the task board that
-- happened not to have been reported yet.
DROP POLICY IF EXISTS "Associates view own tasks" ON public.tasks;
CREATE POLICY "Associates view own tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND (
      assignee_id = auth.uid()
      -- Tasks you handed to somebody else. Without this the RETURNING on the insert that created
      -- the row is refused, and the assignment fails after the row has already been written.
      OR created_by = auth.uid()
      OR assigned_by_id = auth.uid()
    )
  );

-- ─── Assigning upward ───────────────────────────────────────────────────────
-- A coordinator triaging a partner submission often needs it to go to an admin — that is who owns
-- the next step for a company worth a real conversation. 'admin' is added to the roles an associate
-- may assign to.
--
-- 'founder' is deliberately absent. Founders are not a queue an associate can add to, and the
-- distinction was asked for explicitly rather than inferred.
DROP POLICY IF EXISTS "Associates create tasks" ON public.tasks;
CREATE POLICY "Associates create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND created_by = auth.uid()
    AND (
      assignee_id = auth.uid()
      OR (
        SELECT u.role FROM public.users u WHERE u.id = tasks.assignee_id
      ) IN ('associate', 'general', 'hr', 'admin')
    )
  );

-- Updating one you assigned, for the same reason: closing or re-dating a task you handed over is
-- part of having handed it over. The previous policy allowed only the assignee, so a coordinator
-- could not correct their own mistake a minute later.
DROP POLICY IF EXISTS "Associates update own tasks" ON public.tasks;
CREATE POLICY "Associates update own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND (assignee_id = auth.uid() OR created_by = auth.uid() OR assigned_by_id = auth.uid())
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general', 'hr')
    AND (assignee_id = auth.uid() OR created_by = auth.uid() OR assigned_by_id = auth.uid())
  );
