-- General Lead, comments on tasks you handed out, and referral progress for whoever referred.
--
-- ─── 1. General Lead ─────────────────────────────────────────────────────────
-- A team lead over the general users: sees every general user's tasks and can comment on, edit,
-- re-date and reassign them (decided 2026-10-29). Ordinary general users keep today's rights.
--
-- A flag on a general user, not a new role value — same reasoning as is_sgp_coordinator and
-- partner_tier. 'general' is checked by name in a long tail of RLS policies and app guards; a new
-- role would have to be added to every one of them to keep parity, and each one missed would be a
-- silent lock-out. The lead is a general user with one extra set of rights over other general
-- users' tasks, so only those rights fork.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_general_lead BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_general_lead IS
  'General Lead: a general user who can see, comment on, edit and reassign every general user''s tasks. Set by founder/admin in Admin > Users.';

-- Is the caller a General Lead? Only meaningful on a general user.
CREATE OR REPLACE FUNCTION public.is_general_lead()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT is_general_lead FROM public.users WHERE id = auth.uid() AND role = 'general'), false);
$$;

-- Another user's role, for policies that ask "is this task assigned to a general user". Definer so
-- a policy on tasks can ask about users without depending on the users table's own RLS.
CREATE OR REPLACE FUNCTION public.user_role_of(p_user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = p_user;
$$;

REVOKE ALL ON FUNCTION public.is_general_lead() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_role_of(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_general_lead() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_of(UUID) TO authenticated;

DROP POLICY IF EXISTS "General leads see general users' tasks" ON public.tasks;
CREATE POLICY "General leads see general users' tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.is_general_lead()
    AND public.user_role_of(assignee_id) = 'general'
  );

-- Edit, re-date and reassign. The new assignee is still bound by the ordinary assignment rules
-- (the app refuses anything but associate/general/hr, as for every general user).
DROP POLICY IF EXISTS "General leads update general users' tasks" ON public.tasks;
CREATE POLICY "General leads update general users' tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.is_general_lead()
    AND public.user_role_of(assignee_id) = 'general'
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.is_general_lead()
    AND public.user_role_of(assignee_id) IN ('associate', 'general', 'hr')
  );

-- Their push history too, so the KPI view makes sense for the people they lead.
DROP POLICY IF EXISTS "General leads read general users' task pushes" ON public.task_pushes;
CREATE POLICY "General leads read general users' task pushes"
  ON public.task_pushes FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.is_general_lead()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
       WHERE t.id = task_id AND public.user_role_of(t.assignee_id) = 'general'
    )
  );

-- ─── 2. Comments follow who can work on the task ────────────────────────────
-- The comment policy only let associate/general/hr comment on tasks ASSIGNED to them. Since
-- 20260923 they can also see and edit tasks they created or handed out, so the person who assigned
-- a task could open it, edit it, and then get "permission denied (42501)" posting a comment on it
-- (the screenshot of 29 Oct). Comments now follow the same stake as editing, plus General Leads
-- over general users' tasks. The automatic-task comment policy (20260915) is untouched.
CREATE OR REPLACE FUNCTION public.can_discuss_task(p_task UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
     WHERE t.id = p_task
       AND t.org_id = public.get_user_org_id()
       AND (
         public.get_user_role() IN ('founder', 'admin')
         OR t.assignee_id = auth.uid()
         OR t.created_by = auth.uid()
         OR t.assigned_by_id = auth.uid()
         OR (public.is_general_lead() AND public.user_role_of(t.assignee_id) = 'general')
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_discuss_task(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_discuss_task(UUID) TO authenticated;

DROP POLICY IF EXISTS "Task comments follow task visibility" ON public.task_comments;
CREATE POLICY "Task comments follow task visibility"
  ON public.task_comments FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR (
      org_id = public.get_user_org_id()
      AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
      AND public.can_discuss_task(task_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      org_id = public.get_user_org_id()
      AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
      AND public.can_discuss_task(task_id)
    )
  );

-- ─── 3. Referral progress ────────────────────────────────────────────────────
-- Whoever's link brought an entry in sees where it is, on any pipeline (decided 2026-10-29), as a
-- step bar like Projects. The entry row is already readable to them ("Sourcing user reads own
-- sourced entries", 20261007), but a pipeline's stages aren't readable to every role (HR, for
-- one), so the whole picture comes from this function: the caller's own referrals only, and only
-- the stage names, never answers or notes.
CREATE OR REPLACE FUNCTION public.get_my_referral_progress()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'title', e.title,
           'submitter_name', e.submitter_name,
           'submitted_at', e.submitted_at,
           'pipeline_name', p.name,
           'stage_id', e.stage_id,
           'rejected', coalesce(cur.stage_type = 'rejected', false),
           'rejection_reason', CASE WHEN cur.stage_type = 'rejected' THEN e.rejection_reason END,
           -- The path in board order: Lead, then custom stages, then Accepted. Rejected is off it.
           'stages', coalesce((
             SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)
                              ORDER BY CASE s.stage_type WHEN 'lead' THEN 0 WHEN 'custom' THEN 1 ELSE 2 END, s.position)
               FROM public.pipeline_stages s
              WHERE s.pipeline_id = p.id AND s.stage_type <> 'rejected'
           ), '[]'::JSONB)
         ) ORDER BY e.submitted_at DESC), '[]'::JSONB)
    FROM public.pipeline_entries e
    JOIN public.pipelines p ON p.id = e.pipeline_id
    LEFT JOIN public.pipeline_stages cur ON cur.id = e.stage_id
   WHERE e.sourced_by_associate_id = auth.uid()
     AND p.org_id = public.get_user_org_id();
$$;

REVOKE ALL ON FUNCTION public.get_my_referral_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_progress() TO authenticated;
