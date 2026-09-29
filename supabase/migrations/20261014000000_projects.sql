-- Projects: prefunding engagements get their own section.
--
-- Prefunding lived in Active Deals as a deal category with one "Engagement Letter" field. The work
-- itself has a fixed shape an Active Deal can't express: a lead, a first call, a proposal built from
-- a cart of services, a data checklist that depends on those services, a 50% advance before any work
-- starts, two drafts per deliverable, a balance before the final, and — for a valuation — an external
-- registered valuer in the middle. This models that shape directly.
--
-- Two levels. The project moves through shared stages once (lead → first call → proposal → data →
-- advance → in progress → handover → completed, or dormant if the proposal is rejected). Once work
-- starts, each service runs its own track (draft 1 → draft 2 → final; valuation has its own). The
-- project reaches handover when every track is final.
--
-- Visibility (decided 2026-09-29): every internal user sees every project; external users only the
-- projects they hold a role on. The client gets a read-only status link; a partner sees projects a
-- founder/admin credited to them — no claim/approval flow, by decision.

-- ─── Projects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Every lead is entered into Companies, accepted or not ("either way enter them to the database").
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN (
    'lead', 'first_call', 'proposal', 'data', 'advance', 'work', 'handover', 'completed', 'dormant'
  )),
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  first_call_at TIMESTAMPTZ,
  proposal_url TEXT,
  proposal_sent_at TIMESTAMPTZ,
  proposal_decided_at TIMESTAMPTZ,
  rejection_reason TEXT,
  drive_url TEXT,
  work_started_at TIMESTAMPTZ,

  -- Payments. Amounts are what was actually received; the expected figures come from the services
  -- cart (50% of the ex-GST total each, plus GST).
  advance_received_at TIMESTAMPTZ,
  advance_amount_inr NUMERIC,
  balance_received_at TIMESTAMPTZ,
  balance_amount_inr NUMERIC,

  -- Post-handover changes. The engagement allows two; the third is refused (CHECK), not just
  -- discouraged, so the limit holds however the request arrives.
  changes_used INT NOT NULL DEFAULT 0 CHECK (changes_used BETWEEN 0 AND 2),

  -- Credited by a founder/admin only (guard trigger below). Makes the project show on their portal.
  partner_id UUID REFERENCES public.franchise_partners(id) ON DELETE SET NULL,

  -- The client's read-only status link, /pr/<token>.
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  notes TEXT,
  -- Kept when a project came over from Active Deals, so it can be traced back.
  migrated_from_active_deal_id UUID REFERENCES public.active_deals(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_partner ON public.projects(partner_id) WHERE partner_id IS NOT NULL;

-- ─── Stakeholders ────────────────────────────────────────────────────────────
-- One row per person per role: the same person can be Connect and Lead at once.
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('connect', 'lead', 'design', 'finance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

-- ─── Services (the cart) and their tracks ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN (
    'pitch_deck', 'projections', 'valuation', 'market_research', 'dataroom', 'custom'
  )),
  -- Required for 'custom', optional relabel otherwise.
  label TEXT,
  -- Ex-GST. No fixed price list, so it's typed per project.
  price_inr NUMERIC CHECK (price_inr IS NULL OR price_inr >= 0),
  position INT NOT NULL DEFAULT 0,

  -- The track. Valuation has its own vocabulary; every other service is draft 1 → draft 2 → final.
  step TEXT NOT NULL DEFAULT 'not_started' CHECK (step IN (
    'not_started', 'draft_1', 'draft_2',
    'model_built', 'with_valuer', 'valuer_approved', 'draft_report', 'client_approved',
    'final'
  )),
  step_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (service <> 'custom' OR nullif(trim(label), '') IS NOT NULL),
  CHECK (
    (service = 'valuation' AND step IN ('not_started', 'model_built', 'with_valuer', 'valuer_approved', 'draft_report', 'client_approved', 'final'))
    OR (service <> 'valuation' AND step IN ('not_started', 'draft_1', 'draft_2', 'final'))
  )
);

CREATE INDEX IF NOT EXISTS idx_project_services_project ON public.project_services(project_id);

-- ─── Data checklist ──────────────────────────────────────────────────────────
-- Seeded from the chosen services when the proposal is accepted (templates live in the app,
-- src/lib/projects.ts), then editable. 'na' is the proposals' "written confirmation that an item is
-- not available or not applicable".
CREATE TABLE IF NOT EXISTS public.project_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service TEXT,
  label TEXT NOT NULL,
  optional BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'na')),
  position INT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_checklist_project ON public.project_checklist_items(project_id);

-- ─── Timeline ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('stage', 'step', 'payment', 'change', 'note')),
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_events_project ON public.project_events(project_id, created_at DESC);

-- ─── Who can see a project ───────────────────────────────────────────────────
-- SECURITY DEFINER so the child tables' policies can ask about the parent without RLS recursing
-- into projects → project_members → projects (the 20261003 lesson).
CREATE OR REPLACE FUNCTION public.can_see_project(p_project UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
      FROM public.projects p
      JOIN public.users u ON u.id = auth.uid()
     WHERE p.id = p_project
       AND p.org_id = u.org_id
       AND u.role IN ('founder', 'admin', 'associate', 'general', 'hr')
       AND (
         NOT u.is_external
         OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = u.id)
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_see_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_project(UUID) TO authenticated;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal read projects" ON public.projects;
CREATE POLICY "Internal read projects" ON public.projects FOR SELECT TO authenticated
  USING (public.can_see_project(id));

-- Creating one: any internal, non-external user in the org.
DROP POLICY IF EXISTS "Internal create projects" ON public.projects;
CREATE POLICY "Internal create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND NOT coalesce((SELECT is_external FROM public.users WHERE id = auth.uid()), false)
  );

DROP POLICY IF EXISTS "Internal update projects" ON public.projects;
CREATE POLICY "Internal update projects" ON public.projects FOR UPDATE TO authenticated
  USING (public.can_see_project(id)) WITH CHECK (public.can_see_project(id));

DROP POLICY IF EXISTS "Leads delete projects" ON public.projects;
CREATE POLICY "Leads delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.can_see_project(id) AND public.get_user_role() IN ('founder', 'admin'));

DROP POLICY IF EXISTS "Project members access" ON public.project_members;
CREATE POLICY "Project members access" ON public.project_members FOR ALL TO authenticated
  USING (public.can_see_project(project_id)) WITH CHECK (public.can_see_project(project_id));

DROP POLICY IF EXISTS "Project services access" ON public.project_services;
CREATE POLICY "Project services access" ON public.project_services FOR ALL TO authenticated
  USING (public.can_see_project(project_id)) WITH CHECK (public.can_see_project(project_id));

DROP POLICY IF EXISTS "Project checklist access" ON public.project_checklist_items;
CREATE POLICY "Project checklist access" ON public.project_checklist_items FOR ALL TO authenticated
  USING (public.can_see_project(project_id)) WITH CHECK (public.can_see_project(project_id));

DROP POLICY IF EXISTS "Project events access" ON public.project_events;
CREATE POLICY "Project events access" ON public.project_events FOR ALL TO authenticated
  USING (public.can_see_project(project_id)) WITH CHECK (public.can_see_project(project_id));

-- ─── Guards the policies can't express ──────────────────────────────────────
-- Partner credit and payments are founder/admin decisions (payments also the project's lead). RLS
-- can't compare OLD and NEW, so a trigger does it. The SQL editor (no auth.uid()) is allowed.
CREATE OR REPLACE FUNCTION public.guard_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_lead BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  v_role := public.get_user_role();

  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id AND v_role NOT IN ('founder', 'admin') THEN
    RAISE EXCEPTION 'Only a founder or admin can credit a partner.';
  END IF;

  IF (NEW.advance_received_at IS DISTINCT FROM OLD.advance_received_at
      OR NEW.advance_amount_inr IS DISTINCT FROM OLD.advance_amount_inr
      OR NEW.balance_received_at IS DISTINCT FROM OLD.balance_received_at
      OR NEW.balance_amount_inr IS DISTINCT FROM OLD.balance_amount_inr)
     AND v_role NOT IN ('founder', 'admin')
  THEN
    SELECT EXISTS (SELECT 1 FROM public.project_members
                    WHERE project_id = NEW.id AND user_id = auth.uid() AND role = 'lead')
      INTO v_is_lead;
    IF NOT v_is_lead THEN
      RAISE EXCEPTION 'Only a founder, an admin or the project lead can record a payment.';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS projects_guard_update ON public.projects;
CREATE TRIGGER projects_guard_update
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_update();

-- ─── Tasks the project raises ────────────────────────────────────────────────
-- Unlike fundraise automatic tasks (nobody's until they escalate), these are assigned: each step's
-- task goes to whoever holds the matching role. source = 'project' keeps them apart from both.
-- The 20260915 check was declared inline, so its name is Postgres's choice. Drop whichever check
-- constrains `source` rather than trusting the usual name, or 'project' rows would be refused.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.tasks'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%source%automatic%'
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_check CHECK (source IN ('manual', 'automatic', 'project'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- One task per rule per project, ever — done or not. A task someone ticks off before the project
-- moves on must not come back on the next sync. Rules that can recur carry the step in their name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_per_project_rule
  ON public.tasks(project_id, auto_rule) WHERE source = 'project';

-- Anyone who can see the project can see its tasks (the task board's own policies only show an
-- associate their own), so the project page can list who is on what.
DROP POLICY IF EXISTS "Project tasks visible with project" ON public.tasks;
CREATE POLICY "Project tasks visible with project" ON public.tasks FOR SELECT TO authenticated
  USING (source = 'project' AND project_id IS NOT NULL AND public.can_see_project(project_id));

-- The first holder of a role, falling back to the lead, then the connect.
CREATE OR REPLACE FUNCTION public.project_role_holder(p_project UUID, p_role TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.project_members
   WHERE project_id = p_project
   ORDER BY (role = p_role) DESC, (role = 'lead') DESC, (role = 'connect') DESC, created_at
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.project_role_holder(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_service_label(p_service TEXT, p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(trim(p_label), ''), CASE p_service
    WHEN 'pitch_deck' THEN 'Pitch deck'
    WHEN 'projections' THEN 'Financial projections'
    WHEN 'valuation' THEN 'Valuation report'
    WHEN 'market_research' THEN 'Market research'
    WHEN 'dataroom' THEN 'Dataroom'
    ELSE 'Custom engagement' END);
$$;

-- Brings a project's tasks in line with where it is: creates the task for the current step if it
-- has never existed, and closes open ones the project has moved past. Called by every action that
-- moves a project. Rules:
--   lead         schedule_call      Connect   "Set up a first level call with X"
--   first_call   hold_call          Connect   "First level call with X"          due on the call date
--   proposal     send_proposal      Lead      "Send the proposal to X"
--   proposal     chase_proposal     Lead      "Follow up on the proposal with X" once it's been sent
--   data         collect_data       Lead      "Collect the data from X"
--   data         drive_folder       Lead      "Create the Google Drive folder for X" (until linked)
--   advance      collect_advance    Lead      "Collect the 50% advance from X"
--   work         track:<id>:<step>  by service (Finance for projections/valuation, Design for decks)
--   work         collect_balance    Lead      once any deliverable is at draft 2 / client approval
--   handover     handover_call      Lead      "Hand over and walk X through the deliverables"
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

  -- Close what the project has moved past.
  UPDATE public.tasks t
     SET status = 'Done', completed_at = NOW()
   WHERE t.project_id = p.id AND t.source = 'project' AND t.status <> 'Done'
     AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_desired) AS d(rule TEXT) WHERE d.rule = t.auto_rule);

  -- A task raised before anyone held its role goes to whoever holds it now.
  UPDATE public.tasks t
     SET assignee_id = public.project_role_holder(p.id, d.role)
    FROM jsonb_to_recordset(v_desired) AS d(rule TEXT, role TEXT)
   WHERE t.project_id = p.id AND t.source = 'project' AND t.status <> 'Done'
     AND t.auto_rule = d.rule AND t.assignee_id IS NULL;

  -- Create what has never existed.
  INSERT INTO public.tasks (org_id, title, description, status, priority, due_date, assignee_id,
                            company_id, link_url, source, auto_rule, project_id)
  SELECT p.org_id, d.title,
         format('Raised automatically by the %s project.', v_name),
         'To Do', d.priority::task_priority, d.due,
         public.project_role_holder(p.id, d.role),
         p.company_id, format('/projects/%s', p.id), 'project', d.rule, p.id
    FROM jsonb_to_recordset(v_desired) AS d(rule TEXT, title TEXT, role TEXT, due DATE, priority TEXT)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.tasks t WHERE t.project_id = p.id AND t.source = 'project' AND t.auto_rule = d.rule
   );
END $$;

REVOKE ALL ON FUNCTION public.sync_project_tasks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_project_tasks(UUID) TO authenticated;

-- ─── The client's status link: /pr/<token> ───────────────────────────────────
-- Read-only: stages, each service's track, which data items are still outstanding, payment status,
-- and who to contact. Never prices, notes, the timeline or the Drive folder.
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

-- ─── What a partner sees ─────────────────────────────────────────────────────
-- The projects credited to the caller's franchise partner: name, stage, tracks. Nothing internal.
CREATE OR REPLACE FUNCTION public.get_partner_projects()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'company', c.name,
           'logo_url', c.logo_url,
           'stage', p.stage,
           'stage_changed_at', p.stage_changed_at,
           'created_at', p.created_at,
           'services', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'service', s.service,
                      'label', public.project_service_label(s.service, s.label),
                      'step', s.step) ORDER BY s.position, s.created_at)
               FROM public.project_services s WHERE s.project_id = p.id
           ), '[]'::JSONB),
           'contact', (
             SELECT jsonb_build_object('name', u.name, 'email', u.email, 'photo_url', u.photo_url)
               FROM public.users u WHERE u.id = public.project_role_holder(p.id, 'lead')
           )
         ) ORDER BY p.created_at DESC), '[]'::JSONB)
    FROM public.projects p
    JOIN public.users me ON me.id = auth.uid()
    LEFT JOIN public.companies c ON c.id = p.company_id
   WHERE me.franchise_partner_id IS NOT NULL
     AND p.partner_id = me.franchise_partner_id;
$$;

REVOKE ALL ON FUNCTION public.get_partner_projects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_projects() TO authenticated;

-- ─── Moving the Prefunding deals over ────────────────────────────────────────
-- Decided 2026-09-29: existing Prefunding deals become projects, and the category is retired from
-- Active Deals. Each lands at the stage its deal state implies (active → in progress, dormant →
-- dormant, closed → completed; archived deals are left alone) — the team corrects stages by hand.
-- The deal's assignees become the project's leads, its partner (if any) the project's partner, and
-- the Engagement Letter field its proposal link. A deal that was only Prefunding is archived; one
-- that also had another category keeps its other categories and just loses Prefunding.
ALTER TABLE public.deal_categories ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deal_categories.retired IS
  'Hidden from category pickers. Prefunding was retired when it moved to Projects (20261014000000).';

DO $$
DECLARE
  r RECORD;
  v_project UUID;
BEGIN
  FOR r IN
    SELECT ad.id AS deal_id, ad.deal_state, ad.created_at, dc.id AS cat_id, dc.org_id,
           coalesce(c.name, e.title, 'Untitled project') AS name,
           e.company_id, e.id AS entry_id, e.sourced_by_partner_id,
           (SELECT fv.value FROM public.active_deal_field_values fv
              JOIN public.deal_category_fields f ON f.id = fv.field_id
             WHERE fv.active_deal_id = ad.id AND f.category_id = dc.id AND f.label = 'Engagement Letter'
             LIMIT 1) AS letter
      FROM public.active_deals ad
      JOIN public.active_deal_categories adc ON adc.active_deal_id = ad.id
      JOIN public.deal_categories dc ON dc.id = adc.category_id AND dc.name = 'Prefunding'
      JOIN public.pipeline_entries e ON e.id = ad.pipeline_entry_id
      LEFT JOIN public.companies c ON c.id = e.company_id
     WHERE coalesce(ad.deal_state, 'active') <> 'archived'
       AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.migrated_from_active_deal_id = ad.id)
  LOOP
    INSERT INTO public.projects (org_id, name, company_id, stage, stage_changed_at, work_started_at,
                                 proposal_url, partner_id, migrated_from_active_deal_id, created_at)
    VALUES (r.org_id, r.name, r.company_id,
            CASE coalesce(r.deal_state, 'active') WHEN 'dormant' THEN 'dormant' WHEN 'closed' THEN 'completed' ELSE 'work' END,
            NOW(),
            CASE WHEN coalesce(r.deal_state, 'active') IN ('active', 'closed') THEN r.created_at END,
            nullif(trim(r.letter), ''), r.sourced_by_partner_id, r.deal_id, r.created_at)
    RETURNING id INTO v_project;

    INSERT INTO public.project_members (project_id, user_id, role)
    SELECT v_project, a.user_id, 'lead' FROM public.pipeline_entry_assignees a WHERE a.entry_id = r.entry_id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.project_events (project_id, kind, body)
    VALUES (v_project, 'stage', 'Moved over from Active Deals (Prefunding). Check the stage and add the services.');

    IF EXISTS (SELECT 1 FROM public.active_deal_categories x WHERE x.active_deal_id = r.deal_id AND x.category_id <> r.cat_id) THEN
      DELETE FROM public.active_deal_field_values fv
       USING public.deal_category_fields f
       WHERE fv.field_id = f.id AND f.category_id = r.cat_id AND fv.active_deal_id = r.deal_id;
      DELETE FROM public.active_deal_categories WHERE active_deal_id = r.deal_id AND category_id = r.cat_id;
    ELSE
      UPDATE public.active_deals SET deal_state = 'archived' WHERE id = r.deal_id;
    END IF;
  END LOOP;

  UPDATE public.deal_categories SET retired = true WHERE name = 'Prefunding';
END $$;
