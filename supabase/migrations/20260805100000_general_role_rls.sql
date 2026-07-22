-- ═══════════════════════════════════════════════════════════════════════════
-- 'general' role RLS: read-only visibility into deals/companies/investors,
-- full read/write on tasks (same as associate). Every table below already has
-- a single combined FOR ALL policy for founder/admin/associate — Postgres RLS
-- ORs multiple permissive policies together, so granting 'general' read access
-- only requires ADDING one new SELECT-only policy per table. No existing
-- policy is touched, so founder/admin/associate/franchise_partner behavior is
-- completely unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Read-only: pipelines / pipeline_stages / pipeline_entries ────────────────
DROP POLICY IF EXISTS "General read pipelines" ON public.pipelines;
CREATE POLICY "General read pipelines" ON public.pipelines FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General read pipeline stages" ON public.pipeline_stages;
CREATE POLICY "General read pipeline stages" ON public.pipeline_stages FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id())
  );

DROP POLICY IF EXISTS "General read pipeline entries" ON public.pipeline_entries;
CREATE POLICY "General read pipeline entries" ON public.pipeline_entries FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id())
  );

-- ─── Read-only: active_deals / active_deal_categories / active_deal_field_values ──
DROP POLICY IF EXISTS "General read active deals" ON public.active_deals;
CREATE POLICY "General read active deals" ON public.active_deals FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = pipeline_entry_id AND p.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "General read active deal categories" ON public.active_deal_categories;
CREATE POLICY "General read active deal categories" ON public.active_deal_categories FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.active_deals ad
      JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "General read active deal field values" ON public.active_deal_field_values;
CREATE POLICY "General read active deal field values" ON public.active_deal_field_values FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.active_deals ad
      JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
    )
  );

-- ─── Read-only: deal_categories / deal_category_fields ────────────────────────
DROP POLICY IF EXISTS "General read deal categories" ON public.deal_categories;
CREATE POLICY "General read deal categories" ON public.deal_categories FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General read deal category fields" ON public.deal_category_fields;
CREATE POLICY "General read deal category fields" ON public.deal_category_fields FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (SELECT 1 FROM public.deal_categories dc WHERE dc.id = category_id AND dc.org_id = public.get_user_org_id())
  );

-- ─── Read-only: companies + child tables ──────────────────────────────────────
DROP POLICY IF EXISTS "General read companies" ON public.companies;
CREATE POLICY "General read companies" ON public.companies FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_funding_rounds','company_cap_table','company_documents','company_updates','company_field_values']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "General read child" ON public.%I;', t);
    EXECUTE format($p$
      CREATE POLICY "General read child" ON public.%I FOR SELECT TO authenticated
      USING (
        org_id = public.get_user_org_id()
        AND public.get_user_role() = 'general'
        AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.org_id = public.get_user_org_id())
      );
    $p$, t);
  END LOOP;
END $$;

-- ─── Read-only: investors / investor_contacts ─────────────────────────────────
DROP POLICY IF EXISTS "General read investors" ON public.investors;
CREATE POLICY "General read investors" ON public.investors FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General read investor contacts" ON public.investor_contacts;
CREATE POLICY "General read investor contacts" ON public.investor_contacts FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (SELECT 1 FROM public.investors i WHERE i.id = investor_id AND i.org_id = public.get_user_org_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Tasks: widen the existing associate-scoped policies to also cover 'general'
-- (full read/write, same self-scoping to assignee_id = auth.uid()). These
-- REPLACE the existing policies (same shape, widened role check) rather than
-- adding new ones, since the self-scoping condition needs to stay identical.
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Associates view own tasks" ON public.tasks;
CREATE POLICY "Associates view own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general')
    AND assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Associates create tasks" ON public.tasks;
CREATE POLICY "Associates create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general')
    AND created_by = auth.uid()
    AND (
      assignee_id = auth.uid()
      OR (SELECT role FROM public.users WHERE id = assignee_id) IN ('associate', 'general')
    )
  );

DROP POLICY IF EXISTS "Associates update own tasks" ON public.tasks;
CREATE POLICY "Associates update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general')
    AND assignee_id = auth.uid()
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'general')
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
          public.get_user_role() IN ('associate', 'general')
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
          public.get_user_role() IN ('associate', 'general')
          AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
        )
      )
    )
  );
-- personal_todos needs no change — its policy is already self-scoped by user_id with no role check.

-- ─── Recurring tasks: 'general' gets the same view/tick-off access as associate ───
-- (already split by operation, so purely additive new policies — no existing ones touched).
DROP POLICY IF EXISTS "General view recurring tasks" ON public.recurring_tasks;
CREATE POLICY "General view recurring tasks"
  ON public.recurring_tasks FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General update recurring tasks" ON public.recurring_tasks;
CREATE POLICY "General update recurring tasks"
  ON public.recurring_tasks FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general')
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General view completions" ON public.recurring_task_completions;
CREATE POLICY "General view completions"
  ON public.recurring_task_completions FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');

DROP POLICY IF EXISTS "General insert completions" ON public.recurring_task_completions;
CREATE POLICY "General insert completions"
  ON public.recurring_task_completions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() = 'general');
