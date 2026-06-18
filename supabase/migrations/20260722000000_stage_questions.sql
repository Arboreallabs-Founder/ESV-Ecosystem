-- Per-stage questions: admins attach question fields to custom pipeline stages.
-- Moving an entry into such a stage requires answering them; answers display in the
-- entry detail and the active deal detail. Reuses the deal-category field types.

-- ─── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_stage_questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id   UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  label      TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','numeric','percentage','url')),
  required   BOOLEAN NOT NULL DEFAULT false,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_entry_stage_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES public.pipeline_entries(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.pipeline_stage_questions(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  value       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_questions_stage   ON public.pipeline_stage_questions(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_answers_entry     ON public.pipeline_entry_stage_answers(entry_id);
CREATE INDEX IF NOT EXISTS idx_stage_answers_question  ON public.pipeline_entry_stage_answers(question_id);

ALTER TABLE public.pipeline_stage_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_entry_stage_answers  ENABLE ROW LEVEL SECURITY;

-- ─── RLS: pipeline_stage_questions (child of pipeline_stages → pipelines) ─────
DROP POLICY IF EXISTS "Org internal stage questions" ON public.pipeline_stage_questions;
CREATE POLICY "Org internal stage questions"
  ON public.pipeline_stage_questions FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder','admin','associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_stages s
        JOIN public.pipelines p ON p.id = s.pipeline_id
        WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder','admin','associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_stages s
        JOIN public.pipelines p ON p.id = s.pipeline_id
        WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
      )
    )
  );

DROP POLICY IF EXISTS "Partners read stage questions" ON public.pipeline_stage_questions;
CREATE POLICY "Partners read stage questions"
  ON public.pipeline_stage_questions FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND EXISTS (
      SELECT 1 FROM public.pipeline_stages s
      JOIN public.pipelines p ON p.id = s.pipeline_id
      WHERE s.id = stage_id AND p.org_id = public.get_user_org_id()
    )
  );

-- ─── RLS: pipeline_entry_stage_answers (child of pipeline_entries → pipelines) ─
DROP POLICY IF EXISTS "Org internal stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "Org internal stage answers"
  ON public.pipeline_entry_stage_answers FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.get_user_role() IN ('founder','admin','associate')
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
      public.get_user_role() IN ('founder','admin','associate')
      AND EXISTS (
        SELECT 1 FROM public.pipeline_entries pe
        JOIN public.pipelines p ON p.id = pe.pipeline_id
        WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
      )
    )
  );

DROP POLICY IF EXISTS "Partners read stage answers" ON public.pipeline_entry_stage_answers;
CREATE POLICY "Partners read stage answers"
  ON public.pipeline_entry_stage_answers FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND public.entry_has_active_deal(entry_id)
    AND EXISTS (
      SELECT 1 FROM public.pipeline_entries pe
      JOIN public.pipelines p ON p.id = pe.pipeline_id
      WHERE pe.id = entry_id AND p.org_id = public.get_user_org_id()
    )
  );
