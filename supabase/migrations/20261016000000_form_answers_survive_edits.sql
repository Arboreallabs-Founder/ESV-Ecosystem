-- Form answers survive editing the form.
--
-- The bug: saving a form in the builder (saveFormGraph) deleted every form_node and re-inserted it
-- with the same id. pipeline_entry_answers.node_id cascades on delete, so each save silently wiped
-- every stored answer to that form. The entries survived (their title is copied from the first
-- answer at submission), which is why "Alpha Industries" showed with "No answers recorded". The same
-- save also dropped form_nodes.field_key, which the builder doesn't send, so it undid the company-
-- profile tagging of 20261012000000.
--
-- The app now updates questions in place (upsert) and only deletes the ones actually removed. This
-- makes the data safe even if a question IS removed, or anything else deletes a node:
--   1. each answer keeps its own copy of the question's wording (question_text), filled on insert;
--   2. the node foreign key becomes ON DELETE SET NULL, so removing a question leaves its answers.
-- Answers already deleted are not recoverable from here; see the note at the end.

-- ─── 1. The question's wording, on the answer ────────────────────────────────
ALTER TABLE public.pipeline_entry_answers ADD COLUMN IF NOT EXISTS question_text TEXT;

UPDATE public.pipeline_entry_answers a
   SET question_text = n.question_text
  FROM public.form_nodes n
 WHERE n.id = a.node_id AND a.question_text IS NULL;

CREATE OR REPLACE FUNCTION public.answer_copies_question_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.question_text IS NULL AND NEW.node_id IS NOT NULL THEN
    SELECT question_text INTO NEW.question_text FROM public.form_nodes WHERE id = NEW.node_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_entry_answers_copy_question ON public.pipeline_entry_answers;
CREATE TRIGGER pipeline_entry_answers_copy_question
  BEFORE INSERT ON public.pipeline_entry_answers
  FOR EACH ROW EXECUTE FUNCTION public.answer_copies_question_text();

-- ─── 2. Deleting a question no longer deletes its answers ────────────────────
-- The table predates this migration history, so the constraint's name isn't known here: find it.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'public.pipeline_entry_answers'::regclass
       AND con.contype = 'f'
       AND con.confrelid = 'public.form_nodes'::regclass
       AND att.attname = 'node_id'
  LOOP
    EXECUTE format('ALTER TABLE public.pipeline_entry_answers DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.pipeline_entry_answers ALTER COLUMN node_id DROP NOT NULL;
ALTER TABLE public.pipeline_entry_answers
  ADD CONSTRAINT pipeline_entry_answers_node_id_fkey
  FOREIGN KEY (node_id) REFERENCES public.form_nodes(id) ON DELETE SET NULL;

-- ─── 3. Put back the profile-field tags a builder save may have wiped ────────
-- Same statements as 20261012000000; they only set field_key where the wording matches.
DO $$
DECLARE
  v_forms UUID[];
BEGIN
  SELECT array_agg(id) INTO v_forms FROM public.forms WHERE is_partner_form OR is_associate_form;
  IF v_forms IS NULL THEN RETURN; END IF;

  -- Company
  UPDATE public.form_nodes SET field_key = 'company_name'    WHERE form_id = ANY(v_forms) AND question_text = 'What is the name of your startup?';
  UPDATE public.form_nodes SET field_key = 'website'         WHERE form_id = ANY(v_forms) AND question_text IN ('What is your website or company LinkedIn page?', 'Link your website and/or company LinkedIn page');
  UPDATE public.form_nodes SET field_key = 'sector_primary'  WHERE form_id = ANY(v_forms) AND question_text IN ('Which sector does your startup operate in?', 'What sector is your startup operating in?');
  UPDATE public.form_nodes SET field_key = 'sector_secondary' WHERE form_id = ANY(v_forms) AND question_text IN ('Is there a second sector it operates in?', 'And a second sector, if the business spans two.');
  UPDATE public.form_nodes SET field_key = 'business_stage'  WHERE form_id = ANY(v_forms) AND question_text = 'What stage is your startup at?';
  UPDATE public.form_nodes SET field_key = 'entity'          WHERE form_id = ANY(v_forms) AND question_text IN ('How is the company registered?', 'What is the nature of your entity?');
  -- Founder (name/email/phone are already contact_field)
  UPDATE public.form_nodes SET field_key = 'founder_linkedin' WHERE form_id = ANY(v_forms) AND question_text IN ('What is your LinkedIn profile?', 'Please link your personal LinkedIn profile');
  -- Traction
  UPDATE public.form_nodes SET field_key = 'annual_revenue'  WHERE form_id = ANY(v_forms) AND question_text LIKE 'What was your turnover%';
  UPDATE public.form_nodes SET field_key = 'revenue_ytd'     WHERE form_id = ANY(v_forms) AND question_text LIKE 'What is your revenue so far this financial year%';
  UPDATE public.form_nodes SET field_key = 'monthly_revenue' WHERE form_id = ANY(v_forms) AND question_text LIKE 'What was your revenue in the%';
  -- Funding
  UPDATE public.form_nodes SET field_key = 'raised_before'   WHERE form_id = ANY(v_forms) AND question_text = 'Have you raised funds before?';
  UPDATE public.form_nodes SET field_key = 'raised_detail'   WHERE form_id = ANY(v_forms) AND question_text = 'How much did you raise, when, at what valuation, and who invested?';
  UPDATE public.form_nodes SET field_key = 'valuation'       WHERE form_id = ANY(v_forms) AND question_text IN ('What valuation are you raising at? (INR)', 'What is the valuation of the current round (in INR)?');
  UPDATE public.form_nodes SET field_key = 'ask'             WHERE form_id = ANY(v_forms) AND question_text IN ('How much are you raising? (INR)', 'How much do you want to raise in the current round (in INR)?');
  UPDATE public.form_nodes SET field_key = 'soft_commitments' WHERE form_id = ANY(v_forms) AND (question_text LIKE 'Do you have any soft commitments%' OR question_text LIKE 'Have you received any soft commitments%');
  UPDATE public.form_nodes SET field_key = 'soft_detail'     WHERE form_id = ANY(v_forms) AND question_text = 'How much, and from whom?';
  UPDATE public.form_nodes SET field_key = 'deck_url'        WHERE form_id = ANY(v_forms) AND question_text IN ('Where can we find your pitch deck?', 'Please link the pitch deck for your startup.');
  -- Services they want — not company data, but what tells the team what to offer
  UPDATE public.form_nodes SET field_key = 'prefunding_interest' WHERE form_id = ANY(v_forms) AND question_text IN ('Would our pre-funding services be useful to you?', 'Would you be interested in pre-funding services from Earlyseed Ventures?');
  UPDATE public.form_nodes SET field_key = 'prefunding_detail'   WHERE form_id = ANY(v_forms) AND question_text LIKE 'Which pre-funding services do you need?%';
  UPDATE public.form_nodes SET field_key = 'predocs'             WHERE form_id = ANY(v_forms) AND question_text = 'Do you have your pre-funding documents in order?';
  UPDATE public.form_nodes SET field_key = 'incorporation_help'  WHERE form_id = ANY(v_forms) AND question_text IN ('Do you need help incorporating?', 'Do you need help with business incorporation services?');
  UPDATE public.form_nodes SET field_key = 'fundraising_services' WHERE form_id = ANY(v_forms) AND question_text IN ('Which fundraising services would you like?', 'Which fundraising services do you need from Earlyseed Ventures?');
  UPDATE public.form_nodes SET field_key = 'digital_marketing'   WHERE form_id = ANY(v_forms) AND question_text IN ('Would you like support with digital marketing?', 'Do you need support with digital marketing?');
  UPDATE public.form_nodes SET field_key = 'community'           WHERE form_id = ANY(v_forms) AND question_text IN ('Would you like to join a community of startup founders?', 'Would you like to be part of a startup founders'' community?');
END $$;

-- ─── Answers already lost ───────────────────────────────────────────────────
-- Not recoverable by SQL. Supabase's daily backups (Dashboard → Database → Backups) or point-in-time
-- recovery, if the plan has it, hold them as of before the save. Restoring would need a copy of the
-- backup's pipeline_entry_answers rows re-inserted for the affected entries.
