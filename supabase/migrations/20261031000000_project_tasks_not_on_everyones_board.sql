-- Project tasks no longer show on everyone's task board.
--
-- 20261014000000 added "Project tasks visible with project": anyone who can see a project could read
-- its tasks, so the project page could list who is on what. But every internal user can see every
-- project, and the task board renders every task RLS returns, so each associate's board filled up
-- with colleagues' project tasks. That was the "everyone can see each other's tasks" bug.
--
-- The policy goes. The project page reads its task list through this function instead, which
-- checks can_see_project() and returns only what the page shows. Tasks themselves are back to the
-- normal rules: your own (assigned to you, created or handed out by you), or all of them for
-- founders and admins.

DROP POLICY IF EXISTS "Project tasks visible with project" ON public.tasks;

CREATE OR REPLACE FUNCTION public.get_project_tasks(p_project UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  due_date DATE,
  assignee_name TEXT,
  assignee_photo_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.title, t.status::TEXT, t.due_date, u.name, u.photo_url
    FROM public.tasks t
    LEFT JOIN public.users u ON u.id = t.assignee_id
   WHERE t.project_id = p_project
     AND t.source = 'project'
     AND public.can_see_project(p_project)
   ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_project_tasks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_tasks(UUID) TO authenticated;
