-- The real Partner Form, and a display name that is separate from the internal title.
--
-- 20260907 created a six-question placeholder to prove the plumbing. This replaces it with the
-- questions ESV actually asks — the ones the old JotForm collected — so partners issuing their link
-- collect a usable picture of the company instead of a name and a note.
--
-- Two things worth stating up front, because both are deliberate departures from the column list:
--
--   * "Submission date" is not a question. It is pipeline_entries.submitted_at, set by the database.
--     Asking someone to type today's date invites a wrong answer to a fact we already hold.
--
--   * The financial-year questions carried 2022-23 and 2023-24 from when the form was written. A
--     founder filling this in today would be asked about a year three back. They are now phrased as
--     the last completed year and the year to date, with the current years named. Edit them in the
--     builder each April, or reword them to drop the years entirely.
--
-- Everything the form asks that is conditional is asked by branching rather than by trusting people
-- to skip: the renderer requires an answer to every question it shows, so a question that does not
-- apply is a dead end. "Have you raised before → No" now steps over the follow-up entirely.

-- ─── Display name ───────────────────────────────────────────────────────────
-- The title is what the team calls the form in the list; the display name is what a founder sees at
-- the top of it. They want to be different — "Partner Form" is an internal label, and a founder
-- filling it in has no idea what a partner is.
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.forms.display_name IS
  'What the public form shows in its header. Falls back to title when blank.';

-- ─── What the public page reads ─────────────────────────────────────────────
-- get_form_for_submission is left exactly as it is — it is the one function standing between an
-- anonymous visitor and the forms table, and rewriting it to add a field is more risk than the
-- field is worth. This wraps it instead: same object, one key added. A NULL from the inner function
-- (bad token, unpublished form, no pipeline) stays NULL, so the page's error handling is untouched.
CREATE OR REPLACE FUNCTION public.get_public_form(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_jsonb(public.get_form_for_submission(p_token))
    || jsonb_build_object(
         'form_display_name',
         (SELECT f.display_name
            FROM public.form_links fl
            JOIN public.forms f ON f.id = fl.form_id
           WHERE fl.token = p_token)
       );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_form(TEXT) TO anon, authenticated;

-- ─── The questions ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org      UUID;
  v_form     UUID;

  -- Nodes, in the order they are asked.
  n_start UUID; n_end UUID;
  q_startup UUID; q_person UUID; q_site UUID; q_email UUID; q_phone UUID; q_linkedin UUID;
  q_sector1 UUID; q_sector2 UUID;
  q_turnover UUID; q_rev_ytd UUID; q_rev_month UUID;
  q_raised UUID; q_raised_detail UUID;
  q_valuation UUID; q_ask UUID;
  q_soft UUID; q_soft_detail UUID;
  q_stage UUID;
  q_bandwidth UUID; q_predocs UUID; q_prefund UUID; q_prefund_detail UUID;
  q_entity UUID; q_incorp UUID; q_fund_services UUID;
  q_digital UUID; q_community UUID; q_deck UUID;

  -- Option ids needed for conditional edges. An mcq edge matches on the option's id, not its
  -- label — the renderer sends the id back — so a branch built against the text silently
  -- falls through to the default path.
  o_raised_yes UUID; o_raised_no UUID;
  o_soft_yes UUID; o_soft_no UUID;
  o_prefund_yes UUID; o_prefund_no UUID;

  v_answers INT;
  i INT;
  y INT := 0;

  -- The one sector vocabulary (src/lib/taxonomies.ts). Kept identical on purpose: a sector typed
  -- freehand here is a sector that will not match an investor when the deal is worked.
  sectors TEXT[] := ARRAY[
    'AgriTech', 'AI/ML', 'AR/VR', 'B2B', 'Beauty', 'BioTech', 'ClimateTech', 'Consumer',
    'Cybersecurity', 'D2C', 'DeepTech', 'Defence', 'Drones', 'E-commerce', 'EdTech', 'Energy',
    'EV & Mobility', 'Fashion', 'FinTech', 'FoodTech', 'Gaming', 'Hardware', 'HealthTech', 'HRTech',
    'Infrastructure', 'IoT', 'LegalTech', 'Logistics', 'Manufacturing', 'Marketplace', 'Media',
    'Real Estate', 'Retail', 'Robotics', 'SaaS', 'SpaceTech', 'Sports', 'Travel', 'Web3', 'Other'
  ];
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO v_form
      FROM public.forms WHERE org_id = v_org AND is_partner_form LIMIT 1;
    CONTINUE WHEN v_form IS NULL;   -- 20260907 must run first

    -- Never rebuild over answers. If anyone has already submitted, the existing questions are what
    -- they answered, and deleting the nodes would take their answers with them.
    SELECT COUNT(*) INTO v_answers
      FROM public.pipeline_entry_answers a
      JOIN public.form_nodes n ON n.id = a.node_id
     WHERE n.form_id = v_form;
    CONTINUE WHEN v_answers > 0;

    y := 0;   -- canvas layout restarts for each org's form

    UPDATE public.forms
       SET title = 'Partner Form',
           display_name = 'Earlyseed Ventures — Startup Application',
           description = 'Referred by one of our Strategic Growth Partners. Submissions arrive on '
             || 'the Partner Sourced pipeline at Lead.'
     WHERE id = v_form;

    DELETE FROM public.form_edges WHERE form_id = v_form;
    DELETE FROM public.form_node_options
     WHERE node_id IN (SELECT id FROM public.form_nodes WHERE form_id = v_form);
    DELETE FROM public.form_nodes WHERE form_id = v_form;

    -- Laid out in a single column. The builder canvas is free-form, but a straight line is the
    -- honest picture of a form that is a straight line.
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'start', NULL, '', 0, 0) RETURNING id INTO n_start;

    -- ── Who and what ──
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What is the name of your startup?', 0, y) RETURNING id INTO q_startup;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Your full name', 0, y) RETURNING id INTO q_person;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Link your website and/or company LinkedIn page', 0, y) RETURNING id INTO q_site;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Email', 0, y) RETURNING id INTO q_email;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Phone number', 0, y) RETURNING id INTO q_phone;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Please link your personal LinkedIn profile', 0, y) RETURNING id INTO q_linkedin;

    -- ── Sector ──
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'What sector is your startup operating in?', 0, y) RETURNING id INTO q_sector1;
    FOR i IN 1 .. array_length(sectors, 1) LOOP
      INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_sector1, sectors[i], i - 1);
    END LOOP;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'And a second sector, if the business spans two.', 0, y) RETURNING id INTO q_sector2;
    -- First option, so a single-sector company has an answer to give. Every question the renderer
    -- shows must be answered, and there is no "skip".
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_sector2, 'Only one sector', 0);
    FOR i IN 1 .. array_length(sectors, 1) LOOP
      INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_sector2, sectors[i], i);
    END LOOP;

    -- ── Numbers ──
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What was your turnover for the last completed financial year, FY 2025–26 (in INR)?', 0, y) RETURNING id INTO q_turnover;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What is your revenue so far this financial year, FY 2026–27 (in INR)?', 0, y) RETURNING id INTO q_rev_ytd;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What was your revenue in the last operational month (in INR)?', 0, y) RETURNING id INTO q_rev_month;

    -- ── Funding history ──
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Have you raised funds before?', 0, y) RETURNING id INTO q_raised;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_raised, 'Yes', 0) RETURNING id INTO o_raised_yes;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_raised, 'No', 1) RETURNING id INTO o_raised_no;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'How much did you raise, when, at what valuation, and who invested?', 260, y) RETURNING id INTO q_raised_detail;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What is the valuation of the current round (in INR)?', 0, y) RETURNING id INTO q_valuation;
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'How much do you want to raise in the current round (in INR)?', 0, y) RETURNING id INTO q_ask;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Have you received any soft commitments for the current round, including government grants?', 0, y) RETURNING id INTO q_soft;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_soft, 'Yes', 0) RETURNING id INTO o_soft_yes;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_soft, 'No', 1) RETURNING id INTO o_soft_no;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'How much, and from whom?', 260, y) RETURNING id INTO q_soft_detail;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'What stage is your startup at?', 0, y) RETURNING id INTO q_stage;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_stage, 'Idea', 0), (q_stage, 'MVP / prototype', 1), (q_stage, 'Early revenue', 2),
      (q_stage, 'Growth', 3), (q_stage, 'Profitable / scaling', 4);

    -- ── Services ──
    -- Kept as ESV wrote it. It is a notice with a yes/no attached, not really a question, and both
    -- answers carry on — nothing here decides whether we talk to them.
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq',
        'We are currently at capacity for fundraising mandates. Our pre-funding services are open — '
        || 'choose "Yes" below if you would like those.', 0, y) RETURNING id INTO q_bandwidth;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_bandwidth, 'Yes', 0), (q_bandwidth, 'No', 1);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Do you have your pre-funding documents in order?', 0, y) RETURNING id INTO q_predocs;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_predocs, 'Yes', 0), (q_predocs, 'Some of them', 1), (q_predocs, 'No', 2);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Would you be interested in pre-funding services from Earlyseed Ventures?', 0, y) RETURNING id INTO q_prefund;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_prefund, 'Yes', 0) RETURNING id INTO o_prefund_yes;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES (q_prefund, 'No', 1) RETURNING id INTO o_prefund_no;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'Which pre-funding services do you need? For example: financial model, pitch deck, data room, valuation, company profile.', 260, y) RETURNING id INTO q_prefund_detail;

    -- ── Entity ──
    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'What is the nature of your entity?', 0, y) RETURNING id INTO q_entity;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_entity, 'Private Limited', 0), (q_entity, 'LLP', 1), (q_entity, 'Partnership', 2),
      (q_entity, 'Sole Proprietorship', 3), (q_entity, 'Not incorporated yet', 4);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Do you need help with business incorporation services?', 0, y) RETURNING id INTO q_incorp;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_incorp, 'Yes', 0), (q_incorp, 'No', 1);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'Which fundraising services do you need from Earlyseed Ventures?', 0, y) RETURNING id INTO q_fund_services;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Do you need support with digital marketing?', 0, y) RETURNING id INTO q_digital;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_digital, 'Yes', 0), (q_digital, 'No', 1);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'mcq', 'Would you like to be part of a startup founders'' community?', 0, y) RETURNING id INTO q_community;
    INSERT INTO public.form_node_options (node_id, label, position) VALUES
      (q_community, 'Yes', 0), (q_community, 'No', 1);

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Please link the pitch deck for your startup.', 0, y) RETURNING id INTO q_deck;

    y := y + 140;
    INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'end', 'success', NULL, '', 0, y) RETURNING id INTO n_end;

    -- ── The straight run ──
    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id) VALUES
      (v_form, n_start,      q_startup),
      (v_form, q_startup,    q_person),
      (v_form, q_person,     q_site),
      (v_form, q_site,       q_email),
      (v_form, q_email,      q_phone),
      (v_form, q_phone,      q_linkedin),
      (v_form, q_linkedin,   q_sector1),
      (v_form, q_sector1,    q_sector2),
      (v_form, q_sector2,    q_turnover),
      (v_form, q_turnover,   q_rev_ytd),
      (v_form, q_rev_ytd,    q_rev_month),
      (v_form, q_rev_month,  q_raised),
      (v_form, q_raised_detail, q_valuation),
      (v_form, q_valuation,  q_ask),
      (v_form, q_ask,        q_soft),
      (v_form, q_soft_detail, q_stage),
      (v_form, q_stage,      q_bandwidth),
      (v_form, q_bandwidth,  q_predocs),
      (v_form, q_predocs,    q_prefund),
      (v_form, q_prefund_detail, q_entity),
      (v_form, q_entity,     q_incorp),
      (v_form, q_incorp,     q_fund_services),
      (v_form, q_fund_services, q_digital),
      (v_form, q_digital,    q_community),
      (v_form, q_community,  q_deck),
      (v_form, q_deck,       n_end);

    -- ── The three forks ──
    -- condition_value is the option id: that is what the renderer sends back when someone picks an
    -- option, and an edge conditioned on the label would never match.
    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id, condition_value, condition_label) VALUES
      (v_form, q_raised,  q_raised_detail,  o_raised_yes::TEXT,  'Yes'),
      (v_form, q_raised,  q_valuation,      o_raised_no::TEXT,   'No'),
      (v_form, q_soft,    q_soft_detail,    o_soft_yes::TEXT,    'Yes'),
      (v_form, q_soft,    q_stage,          o_soft_no::TEXT,     'No'),
      (v_form, q_prefund, q_prefund_detail, o_prefund_yes::TEXT, 'Yes'),
      (v_form, q_prefund, q_entity,         o_prefund_no::TEXT,  'No');
  END LOOP;
END $$;
