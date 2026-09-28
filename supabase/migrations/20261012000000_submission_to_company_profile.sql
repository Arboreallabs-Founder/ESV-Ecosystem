-- Founder-form and Partner Form answers now reach the company profile.
--
-- Until now a submission's answers lived only in pipeline_entry_answers, readable from the entry's
-- card on the Kanban board. Accepting the entry created the company by name and nothing else, so the
-- profile's Traction, Raise, Founders and Documents sections stayed empty and someone had to retype
-- what the founder had already told us.
--
-- ─── What each question means: form_nodes.field_key ──────────────────────────
-- Explicit, same reasoning as contact_field (20260928000000): matching on question text breaks the
-- first time someone rewords a question in the builder, so the node carries what it means. The tag
-- follows the node, so rewording later is safe. Tagged here by the wording the two forms hold today —
-- both the 20260908 originals and the 20260925 rewording, since either may be live.
ALTER TABLE public.form_nodes ADD COLUMN IF NOT EXISTS field_key TEXT;

COMMENT ON COLUMN public.form_nodes.field_key IS
  'What this question''s answer means (e.g. website, ask, annual_revenue). Drives filling the company profile on acceptance and grouping the Application section. NULL for untagged questions.';

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

-- ─── Amounts as founders type them ───────────────────────────────────────────
-- "2 Cr", "₹50L", "5,00,000", "1.5 crore", "Rs 80 lakh" → rupees. A range takes its low end ("2-3 Cr"
-- → 2 Cr — the unit belongs to both). A number carrying a unit is preferred over a bare one, so
-- "FY 2025-26: 40 lakh" reads as 40 lakh, not 2025. Anything without a number ("Pre-revenue", "NA")
-- is NULL — left out of the profile, still visible verbatim in the Application section, never guessed.
CREATE OR REPLACE FUNCTION public.parse_inr_amount(p_text TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
  m TEXT[];
  u TEXT;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  s := lower(replace(replace(p_text, ',', ''), '₹', ' '));
  s := regexp_replace(s, '\m(rs|inr)\.?', ' ', 'g');
  s := regexp_replace(s, '([0-9]+(\.[0-9]+)?)\s*(-|–|to)\s*[0-9]+(\.[0-9]+)?', '\1', 'g');
  m := regexp_match(s, '([0-9]+(\.[0-9]+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|thousand|k|million|mn|m|billion|bn|b)\M');
  IF m IS NULL THEN
    m := regexp_match(s, '([0-9]+(\.[0-9]+)?)()');
  END IF;
  IF m IS NULL THEN RETURN NULL; END IF;
  u := coalesce(m[3], '');
  RETURN round(m[1]::NUMERIC * CASE
    WHEN u LIKE 'cr%'                           THEN 10000000
    WHEN u LIKE 'la%' OR u = 'l'                THEN 100000
    WHEN u IN ('k', 'thousand')                 THEN 1000
    WHEN u IN ('m', 'mn', 'million')            THEN 1000000
    WHEN u IN ('b', 'bn', 'billion')            THEN 1000000000
    ELSE 1 END);
END $$;

-- ─── Applying a submission to its company ────────────────────────────────────
-- Called by acceptDeal with p_overwrite = true — the team chose "latest submission wins".
-- p_overwrite = false (fill gaps only) is for any future backfill: an old submission is usually
-- older than what the team has typed since, so it should never overwrite.
--
-- SECURITY DEFINER with its own authorisation check, rather than relying on RLS: an RLS-blocked
-- UPDATE affects zero rows without an error, which would make "the profile didn't fill in" silent.
-- Only founder/admin/associate (the roles that can edit companies) in the entry's own org may call
-- it; a run from the SQL editor (no auth.uid(), as for a future backfill) is allowed.
CREATE OR REPLACE FUNCTION public.apply_entry_to_company(p_entry UUID, p_overwrite BOOLEAN DEFAULT true)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_org     UUID;
  a         JSONB := '{}'::JSONB;
  r         RECORD;
  c         public.companies%ROWTYPE;
  v_sectors TEXT[];
  v_num     NUMERIC;
  v_text    TEXT;
  v_fname   TEXT;
  v_fli     TEXT;
  v_idx     INT;
BEGIN
  SELECT e.company_id, p.org_id INTO v_company, v_org
    FROM public.pipeline_entries e JOIN public.pipelines p ON p.id = e.pipeline_id
   WHERE e.id = p_entry;
  IF v_company IS NULL THEN RETURN; END IF;

  IF auth.uid() IS NOT NULL AND NOT (
    public.get_user_org_id() = v_org AND public.get_user_role() IN ('founder', 'admin', 'associate')
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this company.';
  END IF;

  FOR r IN
    SELECT n.field_key, n.contact_field, trim(ans.answer_text) AS val
      FROM public.pipeline_entry_answers ans
      JOIN public.form_nodes n ON n.id = ans.node_id
     WHERE ans.entry_id = p_entry AND nullif(trim(ans.answer_text), '') IS NOT NULL
  LOOP
    IF r.field_key IS NOT NULL THEN a := a || jsonb_build_object(r.field_key, r.val); END IF;
    IF r.contact_field = 'name' THEN a := a || jsonb_build_object('founder_name', r.val); END IF;
  END LOOP;
  IF a = '{}'::JSONB THEN RETURN; END IF;

  SELECT * INTO c FROM public.companies WHERE id = v_company;

  -- Scalars
  v_text := a->>'website';
  IF v_text IS NOT NULL AND (p_overwrite OR nullif(c.website, '') IS NULL) THEN
    UPDATE public.companies SET website = v_text WHERE id = v_company;
  END IF;

  v_text := a->>'entity';
  IF v_text IS NOT NULL AND (p_overwrite OR nullif(c.incorporation_type, '') IS NULL) THEN
    UPDATE public.companies SET incorporation_type = v_text WHERE id = v_company;
  END IF;

  v_num := public.parse_inr_amount(a->>'annual_revenue');
  IF v_num IS NOT NULL AND (p_overwrite OR c.arr_inr IS NULL) THEN
    UPDATE public.companies SET arr_inr = v_num WHERE id = v_company;
  END IF;

  v_num := public.parse_inr_amount(a->>'monthly_revenue');
  IF v_num IS NOT NULL AND (p_overwrite OR c.mrr_inr IS NULL) THEN
    UPDATE public.companies SET mrr_inr = v_num WHERE id = v_company;
  END IF;

  v_num := public.parse_inr_amount(a->>'valuation');
  IF v_num IS NOT NULL AND (p_overwrite OR c.pre_money_inr IS NULL) THEN
    UPDATE public.companies SET pre_money_inr = v_num WHERE id = v_company;
  END IF;

  v_num := public.parse_inr_amount(a->>'ask');
  IF v_num IS NOT NULL AND (p_overwrite OR c.ask_inr IS NULL) THEN
    UPDATE public.companies SET ask_inr = v_num WHERE id = v_company;
  END IF;

  -- Sectors. Latest wins by leading with the submitted ones, but sectors the team added are kept
  -- after them rather than dropped — a list, not a single value to replace.
  v_sectors := array_remove(ARRAY[
    a->>'sector_primary',
    CASE WHEN a->>'sector_secondary' ILIKE 'only one sector' THEN NULL ELSE a->>'sector_secondary' END
  ], NULL);
  IF cardinality(v_sectors) > 0 THEN
    IF p_overwrite THEN
      UPDATE public.companies
         SET sectors = ARRAY(SELECT DISTINCT ON (lower(x)) x
                               FROM unnest(v_sectors || coalesce(c.sectors, '{}')) WITH ORDINALITY t(x, o)
                              ORDER BY lower(x), o)
       WHERE id = v_company;
    ELSIF coalesce(cardinality(c.sectors), 0) = 0 THEN
      UPDATE public.companies SET sectors = v_sectors WHERE id = v_company;
    END IF;
  END IF;

  -- The founder who filled it in: matched by name, LinkedIn added or updated; added as a founder
  -- when not already listed (in fill mode, only if the list is empty — avoids duplicating someone
  -- whose name the team spelled differently).
  v_fname := a->>'founder_name';
  v_fli   := a->>'founder_linkedin';
  IF v_fname IS NOT NULL THEN
    SELECT (t.o - 1)::INT INTO v_idx
      FROM jsonb_array_elements(coalesce(c.founders, '[]'::JSONB)) WITH ORDINALITY t(f, o)
     WHERE lower(trim(t.f->>'name')) = lower(v_fname)
     LIMIT 1;
    IF v_idx IS NOT NULL THEN
      IF v_fli IS NOT NULL AND (p_overwrite OR nullif(c.founders->v_idx->>'linkedin_url', '') IS NULL) THEN
        UPDATE public.companies
           SET founders = jsonb_set(founders, ARRAY[v_idx::TEXT, 'linkedin_url'], to_jsonb(v_fli))
         WHERE id = v_company;
      END IF;
    ELSIF p_overwrite OR jsonb_array_length(coalesce(c.founders, '[]'::JSONB)) = 0 THEN
      UPDATE public.companies
         SET founders = coalesce(founders, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
               'name', v_fname, 'role', 'Founder', 'bio', NULL, 'ex_affiliations', NULL,
               'linkedin_url', v_fli, 'photo_url', NULL, 'equity_pct', NULL))
       WHERE id = v_company;
    END IF;
  END IF;

  -- Pitch deck → Documents, once per URL.
  v_text := a->>'deck_url';
  IF v_text IS NOT NULL AND v_text ~* '(https?://|www\.|\.[a-z]{2,})'
     AND NOT EXISTS (SELECT 1 FROM public.company_documents WHERE company_id = v_company AND url = v_text)
  THEN
    INSERT INTO public.company_documents (company_id, org_id, label, doc_type, url)
    VALUES (v_company, v_org, 'Pitch deck (from application)', 'deck', v_text);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.apply_entry_to_company(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_entry_to_company(UUID, BOOLEAN) TO authenticated;

-- No backfill of already-accepted companies, by decision (2026-09-28). If one is wanted later, loop
-- the accepted entries of both forms, newest first, calling apply_entry_to_company(id, false).
