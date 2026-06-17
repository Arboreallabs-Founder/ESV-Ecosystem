-- Tasks KPI + push/scoping rework, and partner investor editing
-- Idempotent: safe to re-run (IF EXISTS / IF NOT EXISTS throughout)

-- ─── A1. Partners can UPDATE their own referred investors ─────────────────────
-- ESV POC lives in investor_poc_users (no partner write policy) → POC stays admin-only.
-- referred_by_partner_id is pinned to the partner in both USING and WITH CHECK so they
-- cannot reassign the referral away from themselves or move it to another org.
DROP POLICY IF EXISTS "Partners update own referred investors" ON public.investors;
CREATE POLICY "Partners update own referred investors" ON public.investors
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND referred_by_partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND referred_by_partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  );


-- ─── C1. Tasks: retire "In Progress" (data migrate; enum value left dormant) ──
UPDATE public.tasks SET status = 'To Do' WHERE status = 'In Progress';


-- ─── C1. Tasks: KPI / push columns ───────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pushed_date  DATE,
  ADD COLUMN IF NOT EXISTS pushed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_count   INTEGER NOT NULL DEFAULT 0;

-- Best-effort backfill: existing Done tasks get a completed_at so KPI doesn't treat them as open.
UPDATE public.tasks SET completed_at = created_at WHERE status = 'Done' AND completed_at IS NULL;


-- ─── C1. Tasks RLS rework: scope associates to their own assigned tasks ───────
DROP POLICY IF EXISTS "Org internal tasks access"   ON public.tasks;
DROP POLICY IF EXISTS "Admins manage org tasks"     ON public.tasks;
DROP POLICY IF EXISTS "Associates view own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Associates create tasks"     ON public.tasks;
DROP POLICY IF EXISTS "Associates update own tasks" ON public.tasks;

-- Founders & admins: full access to org tasks. Cannot assign a task to a partner.
CREATE POLICY "Admins manage org tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND public.get_user_role() IN ('founder', 'admin')
      AND (
        assignee_id IS NULL
        OR (SELECT role FROM public.users WHERE id = assignee_id) <> 'franchise_partner'
      )
    )
  );

-- Associates: can only see tasks assigned to them.
CREATE POLICY "Associates view own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'associate'
    AND assignee_id = auth.uid()
  );

-- Associates: can only create tasks for themselves or other associates.
CREATE POLICY "Associates create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'associate'
    AND created_by = auth.uid()
    AND (
      assignee_id = auth.uid()
      OR (SELECT role FROM public.users WHERE id = assignee_id) = 'associate'
    )
  );

-- Associates: can only update tasks assigned to them (status changes, pushes).
CREATE POLICY "Associates update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'associate'
    AND assignee_id = auth.uid()
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() = 'associate'
    AND assignee_id = auth.uid()
  );
