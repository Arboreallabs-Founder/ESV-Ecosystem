-- ═══════════════════════════════════════════════════════════════════════════
-- 'general' can read a pipeline entry's details, not just its card.
--
-- 20260805100000_general_role_rls gave general SELECT on pipelines, stages and entries, so the
-- board rendered — but not on the tables the entry detail panel reads. Opening a company showed
-- an empty panel: no form answers, no stage answers, no assignees, no history.
--
-- Same shape as that migration: one additive SELECT-only policy per table, org-scoped through the
-- parent pipeline. Existing FOR ALL policies are untouched, so general stays read-only and every
-- other role is unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

-- Form answers submitted with the entry
DROP POLICY IF EXISTS "General read entry answers" ON public.pipeline_entry_answers;
CREATE POLICY "General read entry answers" ON public.pipeline_entry_answers FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
    )
  );

-- The form questions those answers point at (for wording and order)
DROP POLICY IF EXISTS "General read form nodes" ON public.form_nodes;
CREATE POLICY "General read form nodes" ON public.form_nodes FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.org_id = public.get_user_org_id())
  );

-- Per-stage questions and the entry's answers to them
DROP POLICY IF EXISTS "General read stage questions" ON public.pipeline_stage_questions;
CREATE POLICY "General read stage questions" ON public.pipeline_stage_questions FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_stages s
      JOIN public.pipelines p ON p.id = s.pipeline_id
      WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "General read stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "General read stage answers" ON public.pipeline_entry_stage_answers FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
    )
  );

-- Who is on the entry, and how it moved through stages
DROP POLICY IF EXISTS "General read entry assignees" ON public.pipeline_entry_assignees;
CREATE POLICY "General read entry assignees" ON public.pipeline_entry_assignees FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "General read entry stage history" ON public.pipeline_entry_stage_history;
CREATE POLICY "General read entry stage history" ON public.pipeline_entry_stage_history FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'general'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
    )
  );
