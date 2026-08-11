-- Automatic tasks were never being generated: the function raised on every run.
--
--   column "priority" is of type task_priority but expression is of type text
--
-- tasks.priority is an enum. A bare literal coerces from `unknown`, which is why every hand-written
-- INSERT works — but the result of a CASE expression is `text`, and Postgres will not coerce that
-- implicitly. The generator therefore failed for any fund that matched a rule, and silently did
-- nothing for a database with no matching funds, which is why it looked fine until there was data.
--
-- Replaces the function with the cast. Nothing else changes.

CREATE OR REPLACE FUNCTION public.generate_fundraise_tasks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_made INT := 0;
  v_rule TEXT;
  v_title TEXT;
BEGIN
  FOR r IN
    SELECT fe.id, fe.org_id, fe.status, fe.status_changed_at,
           inv.name AS fund_name,
           COALESCE(c.name, pe.title, 'the company') AS company_name,
           l.active_deal_id,
           EXTRACT(EPOCH FROM (NOW() - fe.status_changed_at)) / 86400 AS days_held
      FROM public.fundraise_entries fe
      JOIN public.fundraise_lists l   ON l.id = fe.list_id
      JOIN public.investors inv       ON inv.id = fe.investor_id
      JOIN public.active_deals d      ON d.id = l.active_deal_id
      JOIN public.pipeline_entries pe ON pe.id = d.pipeline_entry_id
      LEFT JOIN public.companies c    ON c.id = pe.company_id
     WHERE fe.status IN ('data_requested', 'call_request', 'due_diligence', 'deal_sent')
  LOOP
    v_rule := NULL;

    IF r.status = 'data_requested' THEN
      v_rule  := 'data_requested';
      v_title := format('Send data to %s', r.fund_name);

    ELSIF r.status = 'call_request' THEN
      v_rule  := 'call_request';
      v_title := format('Schedule call with %s for %s', r.fund_name, r.company_name);

    ELSIF r.status = 'due_diligence' AND r.days_held > 10 THEN
      v_rule  := 'due_diligence_stalled';
      v_title := format('Follow up with %s for %s', r.fund_name, r.company_name);

    -- Between the chase mark and the ghost mark. Outside that window there is nothing useful to do.
    ELSIF r.status = 'deal_sent' AND r.days_held > 7 AND r.days_held <= 30 THEN
      v_rule  := 'deal_sent_no_reply';
      v_title := format('Chase %s on %s', r.fund_name, r.company_name);
    END IF;

    IF v_rule IS NOT NULL THEN
      INSERT INTO public.tasks (
        org_id, title, description, status, priority, due_date,
        source, auto_rule, fundraise_entry_id
      )
      VALUES (
        r.org_id, v_title,
        format('Raised automatically because %s has been at "%s" for %s day(s).',
               r.fund_name, replace(r.status::TEXT, '_', ' '), floor(r.days_held)),
        'To Do',
        -- Cast required: tasks.priority is an enum, and a CASE expression is text. A bare
        -- literal would coerce from `unknown`; the result of a CASE will not.
        (CASE WHEN v_rule = 'data_requested' THEN 'High' ELSE 'Medium' END)::task_priority,
        (NOW() + INTERVAL '2 days')::DATE,
        'automatic', v_rule, r.id
      )
      ON CONFLICT DO NOTHING;   -- the partial unique index does the deduplication
      IF FOUND THEN v_made := v_made + 1; END IF;
    END IF;
  END LOOP;

  -- ── Close what no longer applies ──────────────────────────────────────────
  -- The fund moved on, so the thing the task asked for has happened. Marked Done rather than
  -- deleted: it did get done, and the record of it is worth keeping.
  UPDATE public.tasks t
     SET status = 'Done', completed_at = COALESCE(t.completed_at, NOW())
    FROM public.fundraise_entries fe
   WHERE t.fundraise_entry_id = fe.id
     AND t.source = 'automatic'
     AND t.status <> 'Done'
     AND (
       (t.auto_rule = 'data_requested'        AND fe.status <> 'data_requested')
       OR (t.auto_rule = 'call_request'       AND fe.status <> 'call_request')
       OR (t.auto_rule = 'due_diligence_stalled' AND fe.status <> 'due_diligence')
       -- The chaser also retires when the fund ghosts: there is no longer anyone to chase.
       OR (t.auto_rule = 'deal_sent_no_reply' AND (fe.status <> 'deal_sent'
             OR fe.status_changed_at < NOW() - INTERVAL '30 days'))
     );

  -- ── Escalation ────────────────────────────────────────────────────────────
  -- Unowned for seven days means nobody picked it up. It becomes the deal assignee's, because an
  -- automatic task nobody ever sees on their own board is one nobody does.
  UPDATE public.tasks t
     SET assignee_id = a.user_id, escalated_at = NOW()
    FROM public.fundraise_entries fe
    JOIN public.fundraise_lists l  ON l.id = fe.list_id
    JOIN public.active_deals d     ON d.id = l.active_deal_id
    JOIN LATERAL (
      SELECT user_id FROM public.pipeline_entry_assignees
       WHERE entry_id = d.pipeline_entry_id
       ORDER BY assigned_at LIMIT 1
    ) a ON TRUE
   WHERE t.fundraise_entry_id = fe.id
     AND t.source = 'automatic'
     AND t.status <> 'Done'
     AND t.assignee_id IS NULL
     AND t.created_at < NOW() - INTERVAL '7 days';

  RETURN v_made;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_fundraise_tasks() TO authenticated;
