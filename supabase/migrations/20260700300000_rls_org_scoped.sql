-- Multi-tenancy Phase 4: drop all old policies, replace with org-scoped versions
-- is_super_admin() always comes FIRST in OR — Postgres short-circuits so NULL org_id check is never evaluated

-- ─── HELPER: drop policies safely ────────────────────────────────────────────
-- Drop known old policies (IF EXISTS is safe if they were already removed)

-- users
DROP POLICY IF EXISTS "Users can view own record"             ON public.users;
DROP POLICY IF EXISTS "Founders and admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update user roles"           ON public.users;

-- approved_emails
DROP POLICY IF EXISTS "Founders and admins manage approved emails" ON public.approved_emails;

-- franchise_partners
DROP POLICY IF EXISTS "Founders and admins manage franchise partners" ON public.franchise_partners;
DROP POLICY IF EXISTS "Franchise partners can view own record"        ON public.franchise_partners;

-- investors
DROP POLICY IF EXISTS "Internal full access"        ON public.investors;
DROP POLICY IF EXISTS "Partners can insert referrals" ON public.investors;

-- investor_contacts
DROP POLICY IF EXISTS "Internal full access"                        ON public.investor_contacts;
DROP POLICY IF EXISTS "Partners can insert contacts on own referrals" ON public.investor_contacts;

-- tasks
DROP POLICY IF EXISTS "Internal users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Internal users can create tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Internal users can update tasks"   ON public.tasks;

-- pipelines
DROP POLICY IF EXISTS "Founders and admins manage pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Internal users view pipelines"         ON public.pipelines;

-- pipeline_stages
DROP POLICY IF EXISTS "Founders and admins manage stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Internal users view stages"         ON public.pipeline_stages;

-- pipeline_entries
DROP POLICY IF EXISTS "Founders and admins manage entries"      ON public.pipeline_entries;
DROP POLICY IF EXISTS "Associates update assigned entries"      ON public.pipeline_entries;
DROP POLICY IF EXISTS "Role-based entry visibility"             ON public.pipeline_entries;
DROP POLICY IF EXISTS "Public form submissions insert entries"  ON public.pipeline_entries;

-- pipeline_entry_answers
DROP POLICY IF EXISTS "Founders and admins manage answers"         ON public.pipeline_entry_answers;
DROP POLICY IF EXISTS "Internal users view answers"                ON public.pipeline_entry_answers;
DROP POLICY IF EXISTS "Public form submissions insert answers"     ON public.pipeline_entry_answers;

-- pipeline_entry_stage_history
DROP POLICY IF EXISTS "internal read stage history"   ON public.pipeline_entry_stage_history;
DROP POLICY IF EXISTS "internal insert stage history" ON public.pipeline_entry_stage_history;

-- forms
DROP POLICY IF EXISTS "Founders and admins manage forms" ON public.forms;
DROP POLICY IF EXISTS "Internal users view forms"         ON public.forms;

-- form_nodes
DROP POLICY IF EXISTS "Founders and admins manage form nodes" ON public.form_nodes;
DROP POLICY IF EXISTS "Internal users view form nodes"         ON public.form_nodes;

-- form_node_options
DROP POLICY IF EXISTS "Founders and admins manage options" ON public.form_node_options;
DROP POLICY IF EXISTS "Internal users view options"         ON public.form_node_options;

-- form_edges
DROP POLICY IF EXISTS "Founders and admins manage form edges" ON public.form_edges;
DROP POLICY IF EXISTS "Internal users view form edges"         ON public.form_edges;

-- form_links
DROP POLICY IF EXISTS "Founders and admins manage form links"   ON public.form_links;
DROP POLICY IF EXISTS "Associates and partners read form links" ON public.form_links;

-- deal_categories
DROP POLICY IF EXISTS "admin write categories"   ON public.deal_categories;
DROP POLICY IF EXISTS "internal read categories" ON public.deal_categories;

-- deal_category_fields
DROP POLICY IF EXISTS "admin write category fields"   ON public.deal_category_fields;
DROP POLICY IF EXISTS "internal read category fields" ON public.deal_category_fields;

-- active_deals
DROP POLICY IF EXISTS "internal read active deals"  ON public.active_deals;
DROP POLICY IF EXISTS "internal write active deals" ON public.active_deals;

-- active_deal_categories
DROP POLICY IF EXISTS "internal read active deal categories"  ON public.active_deal_categories;
DROP POLICY IF EXISTS "internal write active deal categories" ON public.active_deal_categories;

-- active_deal_field_values
DROP POLICY IF EXISTS "internal read field values"  ON public.active_deal_field_values;
DROP POLICY IF EXISTS "internal write field values" ON public.active_deal_field_values;


-- ─── 1. organizations ─────────────────────────────────────────────────────────
CREATE POLICY "Super admins manage organizations"
  ON public.organizations FOR ALL TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Members view own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id());


-- ─── 2. users ────────────────────────────────────────────────────────────────
CREATE POLICY "Users view own record"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Org admins view org users"
  ON public.users FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  );

CREATE POLICY "Org admins update user roles"
  ON public.users FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  );


-- ─── 3. approved_emails ──────────────────────────────────────────────────────
CREATE POLICY "Org admins manage approved emails"
  ON public.approved_emails FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  );


-- ─── 4. franchise_partners ───────────────────────────────────────────────────
CREATE POLICY "Org admins manage franchise partners"
  ON public.franchise_partners FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  );

CREATE POLICY "Partners view own record"
  ON public.franchise_partners FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  );


-- ─── 5. investors ────────────────────────────────────────────────────────────
CREATE POLICY "Org internal full investor access"
  ON public.investors FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  );

CREATE POLICY "Partners insert referrals to own org"
  ON public.investors FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND referred_by_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );


-- ─── 6. investor_contacts ────────────────────────────────────────────────────
-- Child of investors — join to parent for org check
CREATE POLICY "Org internal investor_contacts access"
  ON public.investor_contacts FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.investors i
        WHERE i.id = investor_id AND i.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.investors i
        WHERE i.id = investor_id AND i.org_id = public.get_user_org_id()
      )
    )
  );

CREATE POLICY "Partners insert contacts on own referrals"
  ON public.investor_contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND EXISTS (
      SELECT 1 FROM public.investors i
      WHERE i.id = investor_id
        AND i.org_id = public.get_user_org_id()
        AND i.referred_by_partner_id = (
          SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
        )
    )
  );


-- ─── 7. tasks ────────────────────────────────────────────────────────────────
CREATE POLICY "Org internal tasks access"
  ON public.tasks FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  );


-- ─── 8. pipelines ────────────────────────────────────────────────────────────
CREATE POLICY "Org internal pipeline access"
  ON public.pipelines FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  );


-- ─── 9. pipeline_stages (child of pipelines) ─────────────────────────────────
CREATE POLICY "Org scoped pipeline stages"
  ON public.pipeline_stages FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipelines p
        WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipelines p
        WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 10. pipeline_entries (child of pipelines) ────────────────────────────────
CREATE POLICY "Org internal pipeline entry access"
  ON public.pipeline_entries FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipelines p
        WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipelines p
        WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id()
      )
    )
  );

-- Keep anon INSERT for public form submissions (org context flows through pipeline FK)
CREATE POLICY "Anon public form submission insert"
  ON public.pipeline_entries FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_links fl
      JOIN public.forms f ON f.id = fl.form_id
      WHERE f.pipeline_id = pipeline_id
        AND fl.id = form_link_id
        AND f.published = true
    )
  );


-- ─── 11. pipeline_entry_answers (child of pipeline_entries) ───────────────────
CREATE POLICY "Org scoped entry answers"
  ON public.pipeline_entry_answers FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  );

CREATE POLICY "Anon insert answers for valid entry"
  ON public.pipeline_entry_answers FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pipeline_entries pe WHERE pe.id = entry_id)
  );


-- ─── 12. pipeline_entry_assignees (child of pipeline_entries) ─────────────────
-- No RLS was set before — add it now
ALTER TABLE public.pipeline_entry_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org scoped entry assignees"
  ON public.pipeline_entry_assignees FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 13. pipeline_entry_stage_history (child of pipeline_entries) ─────────────
CREATE POLICY "Org scoped entry stage history"
  ON public.pipeline_entry_stage_history FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 14. forms ───────────────────────────────────────────────────────────────
CREATE POLICY "Org internal forms access"
  ON public.forms FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  );


-- ─── 15. form_nodes (child of forms) ─────────────────────────────────────────
CREATE POLICY "Org scoped form nodes"
  ON public.form_nodes FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 16. form_node_options (child of form_nodes → forms) ─────────────────────
CREATE POLICY "Org scoped form node options"
  ON public.form_node_options FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.form_nodes fn
        JOIN public.forms f ON f.id = fn.form_id
        WHERE fn.id = node_id AND f.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.form_nodes fn
        JOIN public.forms f ON f.id = fn.form_id
        WHERE fn.id = node_id AND f.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 17. form_edges (child of forms) ─────────────────────────────────────────
CREATE POLICY "Org scoped form edges"
  ON public.form_edges FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 18. form_links (child of forms) ─────────────────────────────────────────
CREATE POLICY "Org internal form links access"
  ON public.form_links FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate', 'franchise_partner')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate', 'franchise_partner')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_id AND f.org_id = public.get_user_org_id()
      )
    )
  );

-- form_links must remain readable by anon for public form renderer
CREATE POLICY "Anon read form links by token"
  ON public.form_links FOR SELECT TO anon
  USING (true);


-- ─── 19. deal_categories ─────────────────────────────────────────────────────
CREATE POLICY "Org internal deal_categories access"
  ON public.deal_categories FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  );


-- ─── 20. deal_category_fields (child of deal_categories) ─────────────────────
CREATE POLICY "Org scoped category fields"
  ON public.deal_category_fields FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.deal_categories dc
        WHERE dc.id = category_id AND dc.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.deal_categories dc
        WHERE dc.id = category_id AND dc.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 21. active_deals (child of pipeline_entries → pipelines) ─────────────────
CREATE POLICY "Org scoped active deals"
  ON public.active_deals FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = pipeline_entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = pipeline_entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 22. active_deal_categories (child of active_deals → pipeline_entries → pipelines) ──
CREATE POLICY "Org scoped active deal categories"
  ON public.active_deal_categories FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.active_deals ad
        JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.active_deals ad
        JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
      )
    )
  );


-- ─── 23. active_deal_field_values (child of active_deals) ─────────────────────
CREATE POLICY "Org scoped active deal field values"
  ON public.active_deal_field_values FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.active_deals ad
        JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder', 'admin', 'associate')
      AND EXISTS (
        SELECT 1 FROM public.active_deals ad
        JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE ad.id = active_deal_id AND p.org_id = public.get_user_org_id()
      )
    )
  );
