-- Adds a Yes/No (boolean) field type for pipeline stage questions, alongside the
-- existing text/numeric/percentage/url. Answers still store as TEXT ('true'/'false').

DO $$ BEGIN
  ALTER TABLE public.pipeline_stage_questions DROP CONSTRAINT pipeline_stage_questions_field_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.pipeline_stage_questions
  ADD CONSTRAINT pipeline_stage_questions_field_type_check
  CHECK (field_type IN ('text', 'numeric', 'percentage', 'url', 'boolean'));
