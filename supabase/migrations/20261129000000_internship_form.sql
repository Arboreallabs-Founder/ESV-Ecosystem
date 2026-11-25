-- The public internship form for the ESV website's careers page: /apply/intern, feeding "Interns".
-- Spec: docs/ecosystem-forms/internship-form.md in the website repo, 25 November 2026.
--
-- A website form like the two in 20261126000000, with nothing new behind it: same checks, same
-- notification to founders and admins, no Company created.
--
-- Created UNPUBLISHED. The privacy policy has to cover internship applications and applicants under 18
-- first: it says the forms are for adults and that a minor's details are deleted, while this form lets
-- somebody under 18 apply. Once the policy is approved and live:
--   UPDATE public.forms SET published = true
--    WHERE id = (SELECT form_id FROM public.form_links WHERE slug = 'intern');
--
-- Safe to run again: if the form exists it is left alone, whatever has been edited since.

DO $$
DECLARE
  -- k key, t type (s short, l long, m choice), q wording, c contact field, o options,
  -- b branches (option → key of the question it goes to; every other option goes to '*'), f flags.
  qs JSONB := $json$[
    {"k":"full_name","t":"s","c":"name","q":"What is your full name?"},
    {"k":"email","t":"s","c":"email","q":"What is your email address?"},
    {"k":"phone","t":"s","c":"phone","q":"What is your phone number, with country code?"},
    {"k":"age_18","t":"m","q":"Are you 18 or older?","o":["Yes","No"],"f":{"No":"Under 18: guardian's consent first"}},
    {"k":"city","t":"s","q":"Which city do you live in?"},
    {"k":"status","t":"m","q":"What are you doing at the moment?","o":["Studying","Recently graduated","Working","Other"],"b":{"Studying":"college","Recently graduated":"college","*":"team"}},
    {"k":"college","t":"s","q":"Which college or university, which course, and which year?"},
    {"k":"team","t":"m","q":"Which team would you most like to join?","o":["Investments","Investor relations","Design and communications","Bootcamps and events","Not sure yet"]},
    {"k":"why","t":"l","q":"Why would you like to intern with us?"},
    {"k":"work","t":"l","q":"Tell us about something you have made, studied or worked on that we should know about."},
    {"k":"cv_link","t":"s","q":"Share a link to your CV (for example Google Drive). Please make sure anyone with the link can open it."},
    {"k":"linkedin","t":"s","q":"What is your LinkedIn profile? Type \"None\" if you don't have one."},
    {"k":"portfolio","t":"s","q":"Do you have a portfolio or other work to show? Share a link, or type \"None\"."},
    {"k":"start","t":"s","q":"When could you start?"},
    {"k":"length","t":"m","q":"How long could you intern for?","o":["1 month","2 months","3 months","4 to 6 months","More than 6 months","Not sure yet"]},
    {"k":"time","t":"m","q":"How much time could you give?","o":["Full-time","Part-time","Flexible"]},
    {"k":"mumbai","t":"m","q":"Could you work from our Mumbai office?","o":["Yes","Yes, if I can relocate","No","Some days"]},
    {"k":"heard_from","t":"m","q":"How did you hear about us?","o":["A bootcamp or my campus","LinkedIn","An event","A referral","Press or an article","Web search","Other"],"b":{"A referral":"referrer","*":"consent"}},
    {"k":"referrer","t":"s","q":"Who referred you?"},
    {"k":"consent","t":"m","q":"I agree to Earlyseed Ventures storing these details and contacting me about internships, as described in the privacy policy.","o":["I agree"]}
  ]$json$;
  stages TEXT[] := ARRAY['New application', 'Shortlisted', 'Interview', 'Offer', 'Intern', 'Completed', 'Not now'];
  colors TEXT[] := ARRAY['#745FFD', '#0ea5e9', '#8b5cf6', '#d97706', '#14b8a6', '#16a34a', '#A39B95'];
  q JSONB;
  v_org UUID; v_pipeline UUID; v_form UUID; v_start UUID; v_end UUID; v_node UUID; v_opt UUID;
  ids JSONB := '{}';
  n   INT := jsonb_array_length(qs);
  s   INT := array_length(stages, 1);
  y   INT := 160;
  opt TEXT;
  ord BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
     WHERE fl.slug = 'intern' AND f.is_website_form
  ) THEN
    RAISE NOTICE 'The internship form already exists. Nothing was changed.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.form_links WHERE lower(slug) = 'intern') THEN
    RAISE EXCEPTION 'A referral link is already called "intern". Rename it in Admin > Referrals, then run this again.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_form_links_one_bare_general') THEN
    RAISE EXCEPTION 'Run 20261128000000_website_links_to_esv.sql first. Nothing was changed.';
  END IF;

  -- ESV: the organisation behind the one bare /apply link (20261128000000 made it unique).
  SELECT f.org_id INTO v_org
    FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
   WHERE fl.is_general AND fl.slug IS NULL AND f.is_associate_form;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'The /apply link is missing, so the ESV organisation could not be identified. Nothing was changed.';
  END IF;

  INSERT INTO public.pipelines (org_id, name, description)
  VALUES (v_org, 'Interns', 'People who applied on the ESV website to intern. An application offers nobody a place.')
  RETURNING id INTO v_pipeline;

  -- No 'accepted' stage, on purpose: accepting an entry creates an Active Deal and a Company.
  FOR i IN 1 .. s LOOP
    EXECUTE format(
      'INSERT INTO public.pipeline_stages (pipeline_id, name, position, stage_type, color) VALUES (%L, %L, %L, %L, %L)',
      v_pipeline, stages[i],
      CASE WHEN i = 1 THEN -1 WHEN i = s THEN 999 ELSE i - 2 END,
      CASE WHEN i = 1 THEN 'lead' WHEN i = s THEN 'rejected' ELSE 'custom' END,
      colors[i]);
  END LOOP;

  INSERT INTO public.forms (org_id, title, display_name, description, success_message, pipeline_id, published, is_website_form)
  VALUES (v_org, 'ESV Internship Intake', 'Internship Application',
          'Tell us about yourself and the team you would like to join. Applications are open all year.',
          E'We have your application. Someone from our team will get in touch if there is a good fit.\n\nEarlyseed Ventures, info@earlyseedventures.com',
          v_pipeline, false, true)
  RETURNING id INTO v_form;

  INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
  VALUES (v_form, 'start', NULL, '', 82, 0) RETURNING id INTO v_start;

  -- Cards spaced by how tall they are drawn, so none overlap; the Responses list sorts on position_y.
  FOR i IN 0 .. n - 1 LOOP
    q := qs -> i;
    EXECUTE format(
      'INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, contact_field, field_key, position_x, position_y) '
        || 'VALUES (%L, ''question'', %L, %L, %L, %L, %L, %L) RETURNING id',
      v_form, CASE q ->> 't' WHEN 's' THEN 'short_text' WHEN 'l' THEN 'long_text' ELSE 'mcq' END,
      q ->> 'q', q ->> 'c', q ->> 'k',
      CASE WHEN q ->> 'k' IN ('college', 'referrer') THEN 360 ELSE 0 END, y)
    INTO v_node;
    ids := ids || jsonb_build_object(q ->> 'k', v_node);
    y := y + 220 + 36 * coalesce(jsonb_array_length(q -> 'o'), 0);
  END LOOP;
  INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
  VALUES (v_form, 'end', 'success', NULL, '', 82, y) RETURNING id INTO v_end;

  INSERT INTO public.form_edges (form_id, source_node_id, target_node_id)
  VALUES (v_form, v_start, (ids ->> (qs -> 0 ->> 'k'))::UUID);

  FOR i IN 0 .. n - 1 LOOP
    q := qs -> i;
    v_node := (ids ->> (q ->> 'k'))::UUID;
    IF q ? 'o' THEN
      FOR opt, ord IN SELECT x.label, x.ord FROM jsonb_array_elements_text(q -> 'o') WITH ORDINALITY AS x(label, ord) LOOP
        INSERT INTO public.form_node_options (node_id, label, position, flag)
        VALUES (v_node, opt, ord::INT - 1, q -> 'f' ->> opt) RETURNING id INTO v_opt;
        IF q -> 'b' ? opt THEN
          INSERT INTO public.form_edges (form_id, source_node_id, target_node_id, condition_value, condition_label)
          VALUES (v_form, v_node, (ids ->> (q -> 'b' ->> opt))::UUID, v_opt::TEXT, opt);
        END IF;
      END LOOP;
    END IF;
    -- One line for the rest: every other option, or the only way on.
    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id)
    VALUES (v_form, v_node, CASE
      WHEN q ? 'b'   THEN (ids ->> (q -> 'b' ->> '*'))::UUID
      WHEN i = n - 1 THEN v_end
      ELSE (ids ->> (qs -> (i + 1) ->> 'k'))::UUID END);
  END LOOP;

  INSERT INTO public.form_links (form_id, created_by, label, is_general, slug)
  VALUES (v_form, NULL, 'ESV website', true, 'intern');
END $$;

-- What it did: expect one row, in ESV's organisation, with 20 questions and 7 stages, not published.
SELECT f.title AS form, p.name AS pipeline, o.name AS organisation, '/apply/' || fl.slug AS link, f.published,
       (SELECT count(*) FROM public.form_nodes x WHERE x.form_id = f.id AND x.type = 'question') AS questions,
       (SELECT count(*) FROM public.pipeline_stages x WHERE x.pipeline_id = p.id) AS stages
  FROM public.form_links fl
  JOIN public.forms f ON f.id = fl.form_id
  JOIN public.pipelines p ON p.id = f.pipeline_id
  JOIN public.organizations o ON o.id = f.org_id
 WHERE fl.slug = 'intern';
