-- Projects, round two (decisions of 2026-09-29, after 20261014000000 ran):
--
-- 1. Everyone holding a role gets their own copy of that role's task, instead of only the first
--    person added. The "one per rule per project" index becomes one per rule per project per
--    person. Someone taken off a role loses their open copy.
-- 2. The client's status link shows the Google Drive project folder once it's linked. Making the
--    folder is the first step after the proposal is accepted, and it's where the client puts the
--    data on their checklist.

-- ─── Who holds a role ────────────────────────────────────────────────────────
-- Everyone in the role; if nobody is, the leads; if there are none, the connects. Replaces the
-- single-holder lookup for task assignment (project_role_holder stays for the one contact shown on
-- the client and partner pages).
CREATE OR REPLACE FUNCTION public.project_role_holders(p_project UUID, p_role TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (SELECT user_id, role FROM public.project_members WHERE project_id = p_project)
  SELECT user_id FROM m WHERE role = p_role
  UNION
  SELECT user_id FROM m WHERE role = 'lead' AND NOT EXISTS (SELECT 1 FROM m WHERE role = p_role)
  UNION
  SELECT user_id FROM m WHERE role = 'connect' AND NOT EXISTS (SELECT 1 FROM m WHERE role IN (p_role, 'lead'));
$$;

REVOKE ALL ON FUNCTION public.project_role_holders(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── One task per rule per person ────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_tasks_one_per_project_rule;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_per_project_rule_person
  ON public.tasks(project_id, auto_rule, assignee_id) WHERE source = 'project';

CREATE OR REPLACE FUNCTION public.sync_project_tasks(p_project UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.projects%ROWTYPE;
  s RECORD;
  v_name TEXT;
  v_label TEXT;
  v_role TEXT;
  v_title TEXT;
  -- The tasks the project should have right now: [{rule, title, role, due, priority}]. A JSONB list
  -- rather than a temp table, which is fragile behind a transaction-mode connection pooler.
  v_desired JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_see_project(p_project) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to update this project.';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project;
  IF NOT FOUND THEN RETURN; END IF;
  v_name := p.name;

  IF p.stage = 'lead' THEN
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'schedule_call', 'title', format('Set up a first level call with %s', v_name), 'role', 'connect', 'due', (NOW() + INTERVAL '2 days')::DATE, 'priority', 'High'));
  ELSIF p.stage = 'first_call' THEN
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'hold_call', 'title', format('First level call with %s', v_name), 'role', 'connect', 'due', coalesce(p.first_call_at::DATE, (NOW() + INTERVAL '2 days')::DATE), 'priority', 'High'));
  ELSIF p.stage = 'proposal' THEN
    IF p.proposal_sent_at IS NULL THEN
      v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'send_proposal', 'title', format('Send the proposal to %s', v_name), 'role', 'lead', 'due', (p.stage_changed_at + INTERVAL '3 days')::DATE, 'priority', 'High'));
    ELSE
      v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'chase_proposal', 'title', format('Follow up on the proposal with %s', v_name), 'role', 'lead', 'due', (p.proposal_sent_at + INTERVAL '5 days')::DATE, 'priority', 'Medium'));
    END IF;
  ELSIF p.stage = 'data' THEN
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'collect_data', 'title', format('Collect the data from %s', v_name), 'role', 'lead', 'due', (p.stage_changed_at + INTERVAL '5 days')::DATE, 'priority', 'High'));
    IF nullif(p.drive_url, '') IS NULL THEN
      v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'drive_folder', 'title', format('Create the Google Drive folder for %s', v_name), 'role', 'lead', 'due', (p.stage_changed_at + INTERVAL '2 days')::DATE, 'priority', 'Medium'));
    END IF;
  ELSIF p.stage = 'advance' THEN
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'collect_advance', 'title', format('Collect the 50%% advance from %s', v_name), 'role', 'lead', 'due', (p.stage_changed_at + INTERVAL '3 days')::DATE, 'priority', 'High'));
  ELSIF p.stage = 'work' THEN
    FOR s IN SELECT * FROM public.project_services WHERE project_id = p.id ORDER BY position, created_at LOOP
      v_label := public.project_service_label(s.service, s.label);
      v_role := CASE s.service WHEN 'pitch_deck' THEN 'design' WHEN 'projections' THEN 'finance' WHEN 'valuation' THEN 'finance' ELSE 'lead' END;
      v_title := NULL;
      IF s.service = 'valuation' THEN
        v_title := CASE s.step
          WHEN 'not_started'     THEN format('Build the valuation model for %s', v_name)
          WHEN 'model_built'     THEN format('Send %s''s valuation model to the registered valuer', v_name)
          WHEN 'with_valuer'     THEN format('Follow up with the valuer on %s''s model', v_name)
          WHEN 'valuer_approved' THEN format('Prepare the draft valuation report for %s', v_name)
          WHEN 'draft_report'    THEN format('Get %s''s approval on the draft valuation report', v_name)
          WHEN 'client_approved' THEN format('Send %s the signed valuation report and deck', v_name)
          ELSE NULL END;
        IF s.step IN ('draft_report', 'client_approved') THEN v_role := 'lead'; END IF;
      ELSE
        v_title := CASE s.step
          WHEN 'not_started' THEN format('%s: share draft 1 with %s', v_label, v_name)
          WHEN 'draft_1'     THEN format('%s: share draft 2 with %s', v_label, v_name)
          WHEN 'draft_2'     THEN format('%s: hand over the final to %s', v_label, v_name)
          ELSE NULL END;
      END IF;
      IF v_title IS NOT NULL THEN
        v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', format('track:%s:%s', s.id, s.step), 'title', v_title, 'role', v_role, 'due', (s.step_changed_at + INTERVAL '7 days')::DATE, 'priority', 'Medium'));
      END IF;
    END LOOP;

    IF p.balance_received_at IS NULL AND EXISTS (
      SELECT 1 FROM public.project_services
       WHERE project_id = p.id AND step IN ('draft_2', 'client_approved')
    ) THEN
      v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'collect_balance', 'title', format('Collect the balance payment from %s', v_name), 'role', 'lead', 'due', (NOW() + INTERVAL '3 days')::DATE, 'priority', 'High'));
    END IF;
  ELSIF p.stage = 'handover' THEN
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('rule', 'handover_call', 'title', format('Hand over and walk %s through the deliverables', v_name), 'role', 'lead', 'due', (p.stage_changed_at + INTERVAL '3 days')::DATE, 'priority', 'Medium'));
  END IF;

  -- Close what the project has moved past (every copy).
  UPDATE public.tasks t
     SET status = 'Done', completed_at = NOW()
   WHERE t.project_id = p.id AND t.source = 'project' AND t.status <> 'Done'
     AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_desired) AS d(rule TEXT) WHERE d.rule = t.auto_rule);

  -- Someone taken off a role loses their open copy: deleted, not ticked, so it doesn't show on
  -- their weekly update as work they completed. Unassigned rows from before anyone held the role go
  -- the same way once somebody does.
  DELETE FROM public.tasks t
   USING jsonb_to_recordset(v_desired) AS d(rule TEXT, role TEXT)
   WHERE t.project_id = p.id AND t.source = 'project' AND t.status <> 'Done' AND t.auto_rule = d.rule
     AND EXISTS (SELECT 1 FROM public.project_role_holders(p.id, d.role))
     AND (t.assignee_id IS NULL
          OR t.assignee_id NOT IN (SELECT h FROM public.project_role_holders(p.id, d.role) AS h));

  -- One copy per person holding the role (decided 2026-09-29: everyone gets a copy).
  INSERT INTO public.tasks (org_id, title, description, status, priority, due_date, assignee_id,
                            company_id, link_url, source, auto_rule, project_id)
  SELECT p.org_id, d.title,
         format('Raised automatically by the %s project.', v_name),
         'To Do', d.priority::task_priority, d.due,
         h.uid,
         p.company_id, format('/projects/%s', p.id), 'project', d.rule, p.id
    FROM jsonb_to_recordset(v_desired) AS d(rule TEXT, title TEXT, role TEXT, due DATE, priority TEXT)
   CROSS JOIN LATERAL public.project_role_holders(p.id, d.role) AS h(uid)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.tasks t
      WHERE t.project_id = p.id AND t.source = 'project' AND t.auto_rule = d.rule AND t.assignee_id = h.uid
   );
END $$;

REVOKE ALL ON FUNCTION public.sync_project_tasks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_project_tasks(UUID) TO authenticated;

-- ─── The client link shows the Drive folder ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_project_public(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', p.name,
    'company', c.name,
    'logo_url', c.logo_url,
    'stage', p.stage,
    'stage_changed_at', p.stage_changed_at,
    'work_started_at', p.work_started_at,
    'advance_received', p.advance_received_at IS NOT NULL,
    'balance_received', p.balance_received_at IS NOT NULL,
    'changes_used', p.changes_used,
    -- Shared once set: the client uploads their data into the project folder (decided 2026-09-29).
    'drive_url', p.drive_url,
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'service', s.service,
               'label', public.project_service_label(s.service, s.label),
               'step', s.step) ORDER BY s.position, s.created_at)
        FROM public.project_services s WHERE s.project_id = p.id
    ), '[]'::JSONB),
    'checklist', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'label', i.label, 'service', i.service, 'status', i.status, 'optional', i.optional)
             ORDER BY i.position, i.label)
        FROM public.project_checklist_items i WHERE i.project_id = p.id
    ), '[]'::JSONB),
    'contact', (
      SELECT jsonb_build_object('name', u.name, 'email', u.email, 'photo_url', u.photo_url)
        FROM public.users u WHERE u.id = public.project_role_holder(p.id, 'lead')
    )
  )
  FROM public.projects p
  LEFT JOIN public.companies c ON c.id = p.company_id
  WHERE p.share_token = p_token;
$$;

REVOKE ALL ON FUNCTION public.get_project_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_public(TEXT) TO anon, authenticated;

-- ─── Bring every live project's tasks up to date ────────────────────────────
-- So people already sharing a role get their copies now, not the next time the project moves.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.projects WHERE stage NOT IN ('completed', 'dormant') LOOP
    PERFORM public.sync_project_tasks(r.id);
  END LOOP;
END $$;
