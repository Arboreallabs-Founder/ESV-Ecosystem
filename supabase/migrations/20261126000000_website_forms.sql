-- Two public forms for the ESV website's invest page: /apply/syndicate and /apply/partner.
-- Specs: docs/ecosystem-forms in the website repo, 25 November 2026.
--
-- They use the form system /apply already uses, with four differences, all behind
-- forms.is_website_form so the founder form and every other form behave exactly as before:
--   1. People apply, not companies. submit_form_entry creates a Company named after the first answer;
--      here that would file every applicant as a company under their own name. Skipped.
--   2. Answers are checked on the server: required questions, email, phone, and that each choice is one
--      of the options. The consent question is one of the required ones.
--   3. Some choices put a flag on the entry for the team ("Has questions first", "Syndicate interest").
--   4. Founders and admins are notified of each application (decided 2026-11-25).
--
-- Both forms are created UNPUBLISHED: their consent question points at the privacy policy, which is
-- waiting for approval. See the end of this file for going live.

-- ─── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS is_website_form BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS success_message TEXT;
COMMENT ON COLUMN public.forms.is_website_form IS
  'A public application form on the ESV website (people, not companies). See 20261126000000.';
COMMENT ON COLUMN public.forms.success_message IS
  'Shown after submitting, instead of the standard thank-you. Blank lines separate paragraphs.';

ALTER TABLE public.form_node_options ADD COLUMN IF NOT EXISTS flag TEXT;
COMMENT ON COLUMN public.form_node_options.flag IS
  'On a website form, choosing this option puts this flag on the pipeline entry.';

ALTER TABLE public.pipeline_entries ADD COLUMN IF NOT EXISTS flags TEXT[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.pipeline_entries.flags IS
  'Short notices for the team, shown on the card. Set by website form submissions.';

-- ─── Notification kind ───────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'task_assigned', 'task_reassigned', 'task_comment',
  'leave_submitted', 'leave_decided',
  'expense_submitted', 'expense_decided',
  'kudos_received', 'escalation_raised', 'approval_recorded',
  'bulletin_posted', 'event_posted',
  'mention', 'form_submitted'
));

-- ─── Readable links for website forms ────────────────────────────────────────
-- As 20261013000000, plus: a website form has one general link (credited to nobody) and that link,
-- and only that one, carries a readable name.
CREATE OR REPLACE FUNCTION public.form_links_referral_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_founder_form BOOLEAN;
  v_is_website_form BOOLEAN;
BEGIN
  SELECT is_associate_form, is_website_form INTO v_is_founder_form, v_is_website_form
    FROM public.forms WHERE id = NEW.form_id;

  IF NEW.is_general AND NOT coalesce(v_is_founder_form, false) AND NOT coalesce(v_is_website_form, false) THEN
    RAISE EXCEPTION 'Only the ESV founder form has a general link.';
  END IF;

  IF NEW.slug IS NOT NULL THEN
    IF NOT coalesce(v_is_founder_form, false)
       AND NOT (coalesce(v_is_website_form, false) AND NEW.is_general) THEN
      RAISE EXCEPTION 'Only links on the ESV founder form can have a readable name.';
    END IF;
    NEW.slug := lower(trim(NEW.slug));
  ELSIF TG_OP = 'INSERT' AND coalesce(v_is_founder_form, false) AND NEW.created_by IS NOT NULL AND NOT NEW.is_general THEN
    NEW.slug := public.referral_slug_for(NEW.created_by);
  END IF;

  RETURN NEW;
END $$;

-- As 20261013000000, plus: the website's buttons depend on the readable name staying put.
CREATE OR REPLACE FUNCTION public.protect_general_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IN ('founder', 'admin') OR public.is_super_admin() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_general THEN
    RAISE EXCEPTION 'This is the general link on the ESV website. Only a founder or admin can remove it.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_general IS DISTINCT FROM OLD.is_general THEN
    RAISE EXCEPTION 'Only a founder or admin can change which link is the general one.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_general AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'This link is on the ESV website. Only a founder or admin can rename it.';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_referral_slug(p_slug TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fl.token::TEXT
    FROM public.form_links fl
    JOIN public.forms f ON f.id = fl.form_id
   WHERE lower(fl.slug) = lower(trim(p_slug))
     AND (f.is_associate_form OR f.is_website_form)
   LIMIT 1;
$$;

-- ─── What the public page reads ──────────────────────────────────────────────
-- As 20260928000000, plus website_form, success_message and each node's field_key.
CREATE OR REPLACE FUNCTION public.get_public_form(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT to_jsonb(public.get_form_for_submission(p_token)) AS j
  )
  SELECT
    CASE
      WHEN jsonb_typeof(j) IS DISTINCT FROM 'object' THEN j
      ELSE
        j
        || COALESCE((
             SELECT jsonb_build_object(
                      'form_display_name', f.display_name,
                      'website_form', f.is_website_form,
                      'success_message', f.success_message)
               FROM public.form_links fl
               JOIN public.forms f ON f.id = fl.form_id
              WHERE fl.token = p_token
           ), '{}'::jsonb)
        || CASE WHEN jsonb_typeof(j -> 'nodes') = 'array' THEN
             jsonb_build_object('nodes', COALESCE((
               SELECT jsonb_agg(
                        n || COALESCE((
                          SELECT jsonb_build_object('contact_field', fn.contact_field, 'field_key', fn.field_key)
                            FROM public.form_nodes fn
                           WHERE fn.id = (n ->> 'id')::UUID
                        ), '{}'::jsonb)
                        ORDER BY ord
                      )
                 FROM jsonb_array_elements(j -> 'nodes') WITH ORDINALITY AS t(n, ord)
             ), '[]'::jsonb))
           ELSE '{}'::jsonb END
    END
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_form(TEXT) TO anon, authenticated;

-- ─── Recording an application ────────────────────────────────────────────────
-- Follows the form from its start, so what counts as required is what this person's own path asked.
-- Answers off that path are dropped. Only submit_form_entry calls this; it has already checked that
-- the form is published and that the link and pipeline belong to it.
CREATE OR REPLACE FUNCTION public.submit_website_form(p_link_id UUID, p_form_id UUID, p_pipeline_id UUID, p_answers JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry   UUID := gen_random_uuid();
  v_org     UUID;
  v_stage   UUID;
  v_form    TEXT;
  v_cur     UUID;
  v_next    UUID;
  v_node    RECORD;
  v_text    TEXT;
  v_opt     RECORD;
  v_name    TEXT;
  v_email   TEXT;
  v_digits  TEXT;
  v_flags   TEXT[] := '{}';
  v_nodes   UUID[] := '{}';
  v_texts   TEXT[] := '{}';
BEGIN
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers) > 100 THEN
    RAISE EXCEPTION 'Answers missing' USING ERRCODE = '22023';
  END IF;

  SELECT p.org_id INTO v_org FROM public.pipelines p WHERE p.id = p_pipeline_id;
  SELECT coalesce(display_name, title) INTO v_form FROM public.forms WHERE id = p_form_id;
  SELECT s.id INTO v_stage FROM public.pipeline_stages s
   WHERE s.pipeline_id = p_pipeline_id AND s.stage_type = 'lead' ORDER BY s.position LIMIT 1;

  SELECT e.target_node_id INTO v_cur
    FROM public.form_nodes n JOIN public.form_edges e ON e.source_node_id = n.id
   WHERE n.form_id = p_form_id AND n.type = 'start' LIMIT 1;

  FOR i IN 1..200 LOOP
    SELECT n.id, n.type, n.answer_type, n.contact_field INTO v_node
      FROM public.form_nodes n WHERE n.id = v_cur AND n.form_id = p_form_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Form path broken' USING ERRCODE = '22023'; END IF;
    EXIT WHEN v_node.type = 'end';

    SELECT trim(a ->> 'answer_text') INTO v_text
      FROM jsonb_array_elements(p_answers) AS a WHERE a ->> 'node_id' = v_node.id::TEXT LIMIT 1;
    IF coalesce(v_text, '') = '' OR length(v_text) > 5000 THEN
      RAISE EXCEPTION 'Answer missing or too long' USING ERRCODE = '22023';
    END IF;

    v_next := NULL;
    IF v_node.answer_type = 'mcq' THEN
      SELECT o.id, o.flag INTO v_opt
        FROM public.form_node_options o WHERE o.node_id = v_node.id AND o.label = v_text LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'Not one of the options' USING ERRCODE = '22023'; END IF;
      IF v_opt.flag IS NOT NULL THEN v_flags := array_append(v_flags, v_opt.flag); END IF;
      SELECT e.target_node_id INTO v_next FROM public.form_edges e
       WHERE e.source_node_id = v_node.id AND e.condition_value = v_opt.id::TEXT LIMIT 1;
    END IF;
    IF v_next IS NULL THEN
      SELECT e.target_node_id INTO v_next FROM public.form_edges e
       WHERE e.source_node_id = v_node.id AND e.condition_value IS NULL LIMIT 1;
    END IF;

    IF v_node.contact_field = 'name' THEN
      v_name := left(v_text, 200);
    ELSIF v_node.contact_field = 'email' THEN
      IF length(v_text) > 254 OR v_text !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
        RAISE EXCEPTION 'Email not valid' USING ERRCODE = '22023';
      END IF;
      v_email := v_text;
    ELSIF v_node.contact_field = 'phone' THEN
      v_digits := regexp_replace(v_text, '\D', '', 'g');
      IF length(v_digits) NOT BETWEEN 8 AND 17 THEN
        RAISE EXCEPTION 'Phone not valid' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_nodes := array_append(v_nodes, v_node.id);
    v_texts := array_append(v_texts, v_text);
    v_cur := v_next;
  END LOOP;
  IF v_node.type IS DISTINCT FROM 'end' THEN RAISE EXCEPTION 'Form path broken' USING ERRCODE = '22023'; END IF;

  -- There is no contact record in the app: submissions from one person are tied by their email. Both
  -- are kept, and the later one says so.
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pipeline_entries e
      JOIN public.forms f ON f.id = e.form_id
     WHERE f.is_website_form AND f.org_id = v_org AND lower(e.submitter_email) = lower(v_email)
  ) THEN
    v_flags := array_append(v_flags, 'Applied before');
  END IF;

  INSERT INTO public.pipeline_entries (id, pipeline_id, form_id, form_link_id, stage_id, title, submitter_name, submitter_email, flags)
  VALUES (v_entry, p_pipeline_id, p_form_id, p_link_id, v_stage, left(coalesce(v_name, 'Application'), 120), v_name, v_email, v_flags);

  -- The question's wording is copied onto each answer by trigger (20261016000000), which with
  -- submitted_at is the record of what was consented to and when.
  INSERT INTO public.pipeline_entry_answers (entry_id, node_id, answer_text)
  SELECT v_entry, u.n, u.t FROM unnest(v_nodes, v_texts) AS u(n, t);

  -- Telling the team must never lose the application.
  BEGIN
    INSERT INTO public.notifications (org_id, user_id, kind, title, body, link)
    SELECT v_org, u.id, 'form_submitted', 'New ' || v_form,
           coalesce(v_name, 'Someone') || ' applied on the website.'
             || CASE WHEN cardinality(v_flags) > 0 THEN ' ' || array_to_string(v_flags, '. ') || '.' ELSE '' END,
           '/pipelines/' || p_pipeline_id
      FROM public.users u
     WHERE u.org_id = v_org AND u.role IN ('founder', 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'website form notification failed: %', SQLERRM;
  END;

  RETURN v_entry;
END $$;

REVOKE ALL ON FUNCTION public.submit_website_form(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- 20261010000000 unchanged, apart from handing website forms to the function above.
CREATE OR REPLACE FUNCTION public.submit_form_entry(
  p_link_id uuid,
  p_form_id uuid,
  p_pipeline_id uuid,
  p_first_stage_id uuid,
  p_answers jsonb,
  p_submitter_name text,
  p_submitter_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_title text;
  v_org_id uuid;
  v_company_id uuid;
  v_is_founder_form boolean;
  v_is_website_form boolean;
BEGIN
  -- Validate: published form, link belongs to the form, pipeline matches the form
  IF NOT EXISTS (
    SELECT 1 FROM form_links fl
    JOIN forms f ON f.id = fl.form_id
    WHERE fl.id = p_link_id
      AND f.id = p_form_id
      AND f.published = true
      AND f.pipeline_id = p_pipeline_id
  ) THEN
    RAISE EXCEPTION 'Form not available for submission';
  END IF;

  SELECT is_associate_form, is_website_form INTO v_is_founder_form, v_is_website_form FROM forms WHERE id = p_form_id;
  IF coalesce(v_is_website_form, false) THEN
    RETURN public.submit_website_form(p_link_id, p_form_id, p_pipeline_id, p_answers);
  END IF;

  v_title := COALESCE(NULLIF(LEFT((p_answers->0->>'answer_text'), 120), ''), 'Form submission');

  INSERT INTO pipeline_entries (pipeline_id, form_id, form_link_id, stage_id, title, submitter_name, submitter_email)
  VALUES (p_pipeline_id, p_form_id, p_link_id, p_first_stage_id, v_title,
          NULLIF(p_submitter_name, ''), NULLIF(p_submitter_email, ''))
  RETURNING id INTO v_entry_id;

  IF p_answers IS NOT NULL AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO pipeline_entry_answers (entry_id, node_id, answer_text)
    SELECT v_entry_id, (a->>'node_id')::uuid, a->>'answer_text'
    FROM jsonb_array_elements(p_answers) AS a;
  END IF;

  -- The ESV founder form waits for acceptance; everything else links at submission.
  IF coalesce(v_is_founder_form, false) THEN
    RETURN v_entry_id;
  END IF;

  -- Self-submitted company → create-or-link a Company Profile by name (skip the generic fallback title).
  SELECT org_id INTO v_org_id FROM pipelines WHERE id = p_pipeline_id;
  IF v_org_id IS NOT NULL AND v_title IS NOT NULL AND v_title <> '' AND v_title <> 'Form submission' THEN
    SELECT id INTO v_company_id FROM companies WHERE org_id = v_org_id AND lower(name) = lower(v_title) LIMIT 1;
    IF v_company_id IS NULL THEN
      INSERT INTO companies (org_id, name, status) VALUES (v_org_id, v_title, 'prospect') RETURNING id INTO v_company_id;
    END IF;
    UPDATE pipeline_entries SET company_id = v_company_id WHERE id = v_entry_id;
  END IF;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_form_entry(uuid, uuid, uuid, uuid, jsonb, text, text) TO anon, authenticated;

-- ─── The two forms ───────────────────────────────────────────────────────────
-- Built in the org behind the general /apply link, since /apply/<name> carries no org.
--
-- Each question: k key, t type (s short, l long, m choice), q wording, c contact field, o options,
-- b branches (option → key of the next question; '*' = every other option), f flags (option → flag).
-- Without b, the next question is the following one.
DO $$
DECLARE
  sectors JSONB := '["AgriTech","AI/ML","AR/VR","B2B","Beauty","BioTech","ClimateTech","Consumer","Cybersecurity","D2C","DeepTech","Defence","Drones","E-commerce","EdTech","Energy","EV & Mobility","Fashion","FinTech","FoodTech","Gaming","Hardware","HealthTech","HRTech","Infrastructure","IoT","LegalTech","Logistics","Manufacturing","Marketplace","Media","Real Estate","Retail","Robotics","SaaS","SpaceTech","Sports","Travel","Web3","Other"]';
  specs JSONB;
  spec  JSONB;
  q     JSONB;
  v_org UUID; v_pipeline UUID; v_form UUID; v_start UUID; v_end UUID; v_node UUID; v_opt UUID;
  ids   JSONB;
  n     INT;
  i     INT;
  opt   TEXT;
  dest  TEXT;
BEGIN
  SELECT f.org_id INTO v_org
    FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
   WHERE fl.is_general AND f.is_associate_form ORDER BY fl.created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'The general founder link is missing, so the ESV organisation could not be identified. Run 20261013000000 first.';
  END IF;

  specs := jsonb_build_array(
  -- ── Syndicate ──
  jsonb_build_object(
    'slug', 'syndicate',
    'title', 'ESV Syndicate Intake',
    'display', 'Syndicate Application',
    'desc', 'Tell us a little about yourself and how you like to invest. Your answers go to the Earlyseed Ventures team, and submitting this form does not commit you to anything.',
    'success', E'We have your details. Someone from our team will get in touch to learn how you like to invest.\n\nEarlyseed Ventures, info@earlyseedventures.com',
    'pipeline', 'Syndicate investors',
    'pdesc', 'People who applied to the syndicate on the ESV website. An application admits nobody and commits nobody to invest.',
    'stages', '["New application","Contacted","Deep dive call","Onboarding and KYC","Active member","Not now"]'::jsonb,
    'qs', jsonb_build_array(
      '{"k":"full_name","t":"s","c":"name","q":"What is your full name?"}'::jsonb,
      '{"k":"email","t":"s","c":"email","q":"What is your email address?"}'::jsonb,
      '{"k":"phone","t":"s","c":"phone","q":"What is your phone number, with country code?"}'::jsonb,
      '{"k":"location","t":"s","q":"Which city and country do you live in?"}'::jsonb,
      '{"k":"linkedin","t":"s","q":"What is your LinkedIn profile? Type \"None\" if you don''t have one."}'::jsonb,
      '{"k":"occupation","t":"s","q":"What do you do? Tell us your role and organisation."}'::jsonb,
      '{"k":"investor_type","t":"m","q":"How would you invest?","o":["Individual, resident in India","Individual, NRI or OCI","Individual, foreign national","HUF","Company or LLP","Family office","Trust","Not sure yet"],"b":{"Company or LLP":"entity_name","Family office":"entity_name","Trust":"entity_name","*":"invested_before"}}'::jsonb,
      '{"k":"entity_name","t":"s","q":"What is the name of the entity?"}'::jsonb,
      '{"k":"invested_before","t":"m","q":"Have you invested in start-ups before?","o":["Yes","No, this would be my first"],"b":{"Yes":"past_investments","*":"ticket_size"}}'::jsonb,
      '{"k":"past_investments","t":"l","q":"Roughly how many, and in which companies or sectors? Share only what you are comfortable with."}'::jsonb,
      '{"k":"ticket_size","t":"m","q":"How much would you be comfortable investing in one start-up?","o":["₹5 Lakh to ₹10 Lakh","₹10 Lakh to ₹25 Lakh","₹25 Lakh to ₹50 Lakh","₹50 Lakh to ₹1 Crore","Above ₹1 Crore","Not decided yet"]}'::jsonb,
      '{"k":"deals_per_year","t":"m","q":"How many start-ups would you like to invest in over the next 12 months?","o":["1","2 to 3","4 to 6","More than 6","Not decided yet"]}'::jsonb,
      jsonb_build_object('k','sector_first','t','m','q','Which sector interests you most?','o','["Open to any sector"]'::jsonb || sectors),
      jsonb_build_object('k','sector_second','t','m','q','Is there a second sector that interests you?','o','["No second sector"]'::jsonb || sectors),
      '{"k":"stage","t":"m","q":"Which stage would you prefer to invest at?","o":["Idea or prototype","Early revenue","Growth","Pre-IPO","Open to any stage"]}'::jsonb,
      '{"k":"goals","t":"m","q":"What would you like from the syndicate, beyond access to deals?","o":["Learning how to evaluate start-ups","Meeting other investors","Working with founders","Deal access only","All of these"]}'::jsonb,
      '{"k":"heard_from","t":"m","q":"How did you hear about us?","o":["A referral","LinkedIn","An event","BNI","Press or an article","Web search","Other"],"b":{"A referral":"referrer","*":"notes"}}'::jsonb,
      '{"k":"referrer","t":"s","q":"Who referred you?"}'::jsonb,
      '{"k":"notes","t":"l","q":"Is there anything else we should know? Type \"No\" if not."}'::jsonb,
      '{"k":"risk_ack","t":"m","q":"Investing in early-stage companies is high risk. You may lose all the money you invest, and shares in private companies can be hard to sell. Do you understand this?","o":["Yes, I understand","I have questions first"],"f":{"I have questions first":"Has questions first"}}'::jsonb,
      '{"k":"consent","t":"m","q":"I agree to Earlyseed Ventures storing these details and contacting me about its syndicate, as described in the privacy policy.","o":["I agree"]}'::jsonb
    )),
  -- ── Strategic Growth Partner ──
  jsonb_build_object(
    'slug', 'partner',
    'title', 'ESV Growth Partner Intake',
    'display', 'Strategic Growth Partner Application',
    'desc', 'Tell us about your background, your network and how you would like to work with founders. Your answers go to the Earlyseed Ventures team.',
    'success', E'We have your details. Someone from our team will get in touch to arrange a conversation.\n\nEarlyseed Ventures, info@earlyseedventures.com',
    'pipeline', 'Growth partners',
    'pdesc', 'People who applied on the ESV website to become a Strategic Growth Partner. An application appoints nobody.',
    'stages', '["New application","Contacted","Meeting with co-founders","Terms","Orientation","Active partner","Not now"]'::jsonb,
    'qs', jsonb_build_array(
      '{"k":"full_name","t":"s","c":"name","q":"What is your full name?"}'::jsonb,
      '{"k":"email","t":"s","c":"email","q":"What is your email address?"}'::jsonb,
      '{"k":"phone","t":"s","c":"phone","q":"What is your phone number, with country code?"}'::jsonb,
      '{"k":"location","t":"s","q":"Which city and country do you live in?"}'::jsonb,
      '{"k":"linkedin","t":"s","q":"What is your LinkedIn profile? Type \"None\" if you don''t have one."}'::jsonb,
      '{"k":"role_org","t":"s","q":"What is your current role and organisation?"}'::jsonb,
      '{"k":"experience_years","t":"m","q":"How many years of professional experience do you have?","o":["Under 10","10 to 20","20 to 30","Over 30"]}'::jsonb,
      '{"k":"field","t":"m","q":"Which field best describes your work?","o":["Business coaching or advisory","Finance, banking or lending","Law or intellectual property","Marketing or sales","Technology","Manufacturing or industry","Healthcare","Education or campus","Real estate or infrastructure","Government or public sector","Other"]}'::jsonb,
      '{"k":"background","t":"l","q":"Tell us about your background, in a few sentences."}'::jsonb,
      '{"k":"contribution","t":"m","q":"How would you most like to help?","o":["Mentoring founders","Opening doors to customers and industry","Introducing investors","Finding promising start-ups","Supporting campus programmes","A mix of these"]}'::jsonb,
      '{"k":"region","t":"m","q":"Which region do you know best?","o":["Mumbai","Rest of West India","North India","South India","East or North-East India","Central India","UAE","Elsewhere outside India"],"b":{"Elsewhere outside India":"region_other","*":"network"}}'::jsonb,
      '{"k":"region_other","t":"s","q":"Which country or region?"}'::jsonb,
      '{"k":"network","t":"l","q":"Describe your network: the industries, business groups or communities you are active in. Please don''t name private individuals."}'::jsonb,
      '{"k":"startup_experience","t":"m","q":"Have you mentored, advised or invested in start-ups before?","o":["Yes","No"],"b":{"Yes":"startup_details","*":"other_roles"}}'::jsonb,
      '{"k":"startup_details","t":"l","q":"Tell us briefly about that work."}'::jsonb,
      '{"k":"other_roles","t":"m","q":"Do you hold a role with another fund, angel network, accelerator or start-up platform?","o":["Yes","No"],"b":{"Yes":"other_roles_details","*":"time"}}'::jsonb,
      '{"k":"other_roles_details","t":"l","q":"Which one, and what is your role?"}'::jsonb,
      '{"k":"time","t":"m","q":"How much time could you give in a typical month?","o":["A few hours","1 to 2 days","3 to 5 days","More than 5 days","Not sure yet"]}'::jsonb,
      '{"k":"why","t":"l","q":"Why would you like to be a Strategic Growth Partner?"}'::jsonb,
      '{"k":"syndicate_interest","t":"m","q":"Would you also like to hear about investing through our syndicate?","o":["Yes","Maybe later","No"],"f":{"Yes":"Syndicate interest"}}'::jsonb,
      '{"k":"heard_from","t":"m","q":"How did you hear about us?","o":["A current growth partner","Another referral","LinkedIn","An event","BNI","Press or an article","Web search","Other"],"b":{"A current growth partner":"referrer","Another referral":"referrer","*":"consent"}}'::jsonb,
      '{"k":"referrer","t":"s","q":"Who referred you?"}'::jsonb,
      '{"k":"consent","t":"m","q":"I agree to Earlyseed Ventures storing these details and contacting me about becoming a partner, as described in the privacy policy.","o":["I agree"]}'::jsonb
    ))
  );

  FOR spec IN SELECT s FROM jsonb_array_elements(specs) AS s LOOP
    -- Already built: leave it alone, whatever has been edited since.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
       WHERE fl.slug = spec ->> 'slug' AND f.is_website_form);
    IF EXISTS (SELECT 1 FROM public.form_links WHERE lower(slug) = spec ->> 'slug') THEN
      RAISE EXCEPTION 'A referral link is already called "%". Rename it in Admin > Referrals, then run this again.', spec ->> 'slug';
    END IF;

    INSERT INTO public.pipelines (org_id, name, description)
    VALUES (v_org, spec ->> 'pipeline', spec ->> 'pdesc') RETURNING id INTO v_pipeline;

    -- No 'accepted' stage, on purpose: accepting an entry creates an Active Deal and a Company.
    n := jsonb_array_length(spec -> 'stages');
    FOR i IN 0 .. n - 1 LOOP
      -- Built with %L literals because these tables pre-date the migration history: a literal fits the
      -- column whether it is text or an enum, a CASE expression would only fit text.
      EXECUTE format(
        'INSERT INTO public.pipeline_stages (pipeline_id, name, position, stage_type, color) VALUES (%L, %L, %L, %L, %L)',
        v_pipeline, spec -> 'stages' ->> i,
        CASE WHEN i = 0 THEN -1 WHEN i = n - 1 THEN 999 ELSE i - 1 END,
        CASE WHEN i = 0 THEN 'lead' WHEN i = n - 1 THEN 'rejected' ELSE 'custom' END,
        CASE WHEN i = n - 1 THEN '#A39B95'
             ELSE (ARRAY['#745FFD', '#0ea5e9', '#8b5cf6', '#d97706', '#14b8a6', '#16a34a'])[i + 1] END);
    END LOOP;

    INSERT INTO public.forms (org_id, title, display_name, description, success_message, pipeline_id, published, is_website_form)
    VALUES (v_org, spec ->> 'title', spec ->> 'display', spec ->> 'desc', spec ->> 'success', v_pipeline, false, true)
    RETURNING id INTO v_form;

    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'start', NULL, '', 0, 0) RETURNING id INTO v_start;

    -- Questions, top to bottom in order: the Responses list sorts on position_y.
    ids := '{}';
    n := jsonb_array_length(spec -> 'qs');
    FOR i IN 0 .. n - 1 LOOP
      q := spec -> 'qs' -> i;
      EXECUTE format(
        'INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, contact_field, field_key, position_x, position_y) '
          || 'VALUES (%L, ''question'', %L, %L, %L, %L, 0, %L) RETURNING id',
        v_form, CASE q ->> 't' WHEN 's' THEN 'short_text' WHEN 'l' THEN 'long_text' ELSE 'mcq' END,
        q ->> 'q', q ->> 'c', q ->> 'k', (i + 1) * 140)
      INTO v_node;
      ids := ids || jsonb_build_object(q ->> 'k', v_node);
    END LOOP;
    INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'end', 'success', NULL, '', 0, (n + 1) * 140) RETURNING id INTO v_end;

    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id)
      VALUES (v_form, v_start, (ids ->> (spec -> 'qs' -> 0 ->> 'k'))::UUID);

    FOR i IN 0 .. n - 1 LOOP
      q := spec -> 'qs' -> i;
      v_node := (ids ->> (q ->> 'k'))::UUID;
      IF q ? 'o' THEN
        FOR opt, dest IN
          SELECT o.label, o.ord::TEXT FROM jsonb_array_elements_text(q -> 'o') WITH ORDINALITY AS o(label, ord)
        LOOP
          INSERT INTO public.form_node_options (node_id, label, position, flag)
            VALUES (v_node, opt, dest::INT - 1, q -> 'f' ->> opt) RETURNING id INTO v_opt;
          -- A branching question gets an edge for every option, so there is no "anything else" edge
          -- whose order could matter. condition_value is the option's id.
          IF q ? 'b' THEN
            INSERT INTO public.form_edges (form_id, source_node_id, target_node_id, condition_value, condition_label)
              VALUES (v_form, v_node, (ids ->> coalesce(q -> 'b' ->> opt, q -> 'b' ->> '*'))::UUID, v_opt::TEXT, opt);
          END IF;
        END LOOP;
      END IF;
      IF NOT q ? 'b' THEN
        INSERT INTO public.form_edges (form_id, source_node_id, target_node_id)
          VALUES (v_form, v_node, CASE WHEN i = n - 1 THEN v_end ELSE (ids ->> (spec -> 'qs' -> (i + 1) ->> 'k'))::UUID END);
      END IF;
    END LOOP;

    INSERT INTO public.form_links (form_id, created_by, label, is_general, slug)
      VALUES (v_form, NULL, 'ESV website', true, spec ->> 'slug');
  END LOOP;
END $$;

-- ─── Going live ──────────────────────────────────────────────────────────────
-- Once the privacy policy is approved and public at /privacy:
--   UPDATE public.forms SET published = true WHERE is_website_form;
