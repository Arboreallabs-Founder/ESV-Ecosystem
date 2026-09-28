-- The ESV referral link is handed to founders, who fill it in about their own company — not to
-- someone passing a lead on. 20261007000000/20261008000000 worded it as a third-party referral, and
-- asked for "who is the contact" as a free-text question with no contact_field, so the renderer's
-- trailing name/email step (FormRenderer.tsx) then asked the founder for the same thing again.

-- ─── Header: internal label vs what the founder sees ────────────────────────
-- display_name (20260908000000) is the public header; title stays as the team's label in /forms.
UPDATE public.forms
SET
  title = 'ESV Founder Intake',
  display_name = 'Tell us about your startup',
  description = 'We''d love to hear what you''re building. A few quick questions — your answers go '
    || 'straight to the Earlyseed Ventures team, and we''ll be in touch.'
WHERE is_associate_form;

-- ─── Questions, in the founder's own voice ───────────────────────────────────
-- Updated in place (matched on the seeded wording) rather than rebuilt: form_nodes ids are what
-- pipeline_entry_answers point at, so deleting and re-creating them would orphan any answers
-- already submitted. A node someone has since reworded in the builder is left alone.
DO $$
DECLARE
  v_form    UUID;
  v_contact UUID;
  v_why     UUID;
  v_email   UUID;
BEGIN
  FOR v_form IN SELECT id FROM public.forms WHERE is_associate_form LOOP
    UPDATE public.form_nodes SET question_text = 'What''s your company called?'
      WHERE form_id = v_form AND question_text = 'Company name';
    UPDATE public.form_nodes SET question_text = 'Company website or LinkedIn'
      WHERE form_id = v_form AND question_text = 'Website or LinkedIn';
    UPDATE public.form_nodes SET question_text = 'What sector are you in?'
      WHERE form_id = v_form AND question_text = 'What sector are they in?';

    -- The free-text "who is the contact" becomes a tagged name question, and an email question is
    -- inserted after it. With both tagged, the renderer skips its trailing contact step entirely and
    -- the answers land in pipeline_entries.submitter_name/submitter_email.
    UPDATE public.form_nodes
      SET question_text = 'Your name', contact_field = 'name'
      WHERE form_id = v_form AND question_text = 'Who is the contact, and how do we reach them?'
      RETURNING id INTO v_contact;

    UPDATE public.form_nodes
      SET question_text = 'What are you building, and what are you raising?'
      WHERE form_id = v_form AND question_text = 'Anything we should know before we reach out?'
      RETURNING id INTO v_why;

    IF v_contact IS NOT NULL AND v_why IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.form_nodes WHERE form_id = v_form AND contact_field = 'email')
    THEN
      INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, contact_field, position_x, position_y)
        VALUES (v_form, 'question', 'short_text', 'Your email', 'email', 250, 675)
        RETURNING id INTO v_email;
      -- name → why becomes name → email → why.
      UPDATE public.form_edges SET target_node_id = v_email
        WHERE form_id = v_form AND source_node_id = v_contact AND target_node_id = v_why;
      INSERT INTO public.form_edges (form_id, source_node_id, target_node_id)
        VALUES (v_form, v_email, v_why);
    END IF;
  END LOOP;
END $$;

UPDATE public.pipelines
SET description = 'Founders who came in through a team member''s link, credited to whoever shared '
    || 'it. Everything lands at Lead.'
WHERE is_associate_intake;

-- ─── Narrow the read policy to this pipeline ─────────────────────────────────
-- attribute_entry_to_sourcer() credits any internal user's link on any form, so the unscoped
-- "Sourcing user reads own sourced entries" (20261007000000) let an associate read entries on other
-- pipelines they had issued a link for — access nobody asked for. Scoped to the referral pipeline.
-- The pipeline check goes through a SECURITY DEFINER function rather than a subquery so it cannot
-- re-enter any pipelines policy — the indirect recursion 20261004000000 had to fix.
CREATE OR REPLACE FUNCTION public.is_associate_intake_pipeline(p_pipeline_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pipelines WHERE id = p_pipeline_id AND is_associate_intake);
$$;

REVOKE ALL ON FUNCTION public.is_associate_intake_pipeline(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_associate_intake_pipeline(UUID) TO authenticated;

DROP POLICY IF EXISTS "Sourcing user reads own sourced entries" ON public.pipeline_entries;
CREATE POLICY "Sourcing user reads own sourced entries"
  ON public.pipeline_entries FOR SELECT TO authenticated
  USING (
    sourced_by_associate_id = auth.uid()
    AND public.is_associate_intake_pipeline(pipeline_id)
  );
