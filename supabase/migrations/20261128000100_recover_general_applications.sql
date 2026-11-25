-- Founder applications that came through /apply while it pointed at another organisation (see
-- 20261128000000, which must run first) move to ESV Referrals, at Lead, with their answers and their
-- original date.
--
-- Only entries that arrived through that organisation's general link: nothing it collected any other
-- way. An entry already accepted there into an Active Deal is left alone and listed at the end.

DO $$
DECLARE
  v_link     UUID;
  v_form     UUID;
  v_pipeline UUID;
  v_stage    UUID;
  v_old      UUID[];
  v_entries  UUID[];
BEGIN
  SELECT fl.id, f.id, f.pipeline_id INTO v_link, v_form, v_pipeline
    FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
   WHERE fl.is_general AND f.is_associate_form;
  IF (SELECT count(*) FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
       WHERE fl.is_general AND f.is_associate_form) <> 1 THEN
    RAISE EXCEPTION 'Run 20261128000000_website_links_to_esv.sql first. Nothing was changed.';
  END IF;

  SELECT s.id INTO v_stage FROM public.pipeline_stages s
   WHERE s.pipeline_id = v_pipeline AND s.stage_type = 'lead' ORDER BY s.position LIMIT 1;
  IF v_stage IS NULL THEN RAISE EXCEPTION 'ESV Referrals has no Lead stage. Nothing was changed.'; END IF;

  -- The former general links: made by 20261013000000, so no creator, on another founder form.
  SELECT array_agg(fl.id) INTO v_old
    FROM public.form_links fl JOIN public.forms f ON f.id = fl.form_id
   WHERE f.is_associate_form AND f.id <> v_form AND fl.created_by IS NULL
     AND fl.label = 'General (website and company page)';

  SELECT array_agg(e.id) INTO v_entries
    FROM public.pipeline_entries e
   WHERE e.form_link_id = ANY (v_old)
     AND NOT EXISTS (SELECT 1 FROM public.active_deals d WHERE d.pipeline_entry_id = e.id);
  IF v_entries IS NULL THEN RAISE NOTICE 'No applications to move.'; RETURN; END IF;

  -- Answers follow to the same question on ESV's form, where its wording is the same. Where it isn't,
  -- the answer keeps the wording saved with it (20261016000000).
  UPDATE public.pipeline_entry_answers a
     SET node_id = (
       SELECT n2.id FROM public.form_nodes n2
        WHERE n2.form_id = v_form AND n2.type = 'question' AND n2.question_text = n1.question_text
        ORDER BY n2.position_y LIMIT 1)
    FROM public.form_nodes n1
   WHERE n1.id = a.node_id AND a.entry_id = ANY (v_entries);

  -- Nobody there should stay on them.
  DELETE FROM public.pipeline_entry_assignees WHERE entry_id = ANY (v_entries);

  UPDATE public.pipeline_entries
     SET pipeline_id = v_pipeline, stage_id = v_stage, form_id = v_form, form_link_id = v_link,
         company_id = NULL, rejection_reason = NULL
   WHERE id = ANY (v_entries);

  RAISE NOTICE 'Moved % application(s).', cardinality(v_entries);
END $$;

-- What is on ESV Referrals through /apply now, and anything left behind.
SELECT CASE WHEN fl.is_general THEN 'ESV Referrals' ELSE 'LEFT BEHIND (already an Active Deal there)' END AS place,
       e.title, e.submitter_name, e.submitter_email, e.submitted_at
  FROM public.pipeline_entries e
  JOIN public.form_links fl ON fl.id = e.form_link_id
  JOIN public.forms f ON f.id = fl.form_id
 WHERE f.is_associate_form AND fl.label = 'General (website and company page)'
 ORDER BY e.submitted_at DESC;
