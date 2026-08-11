-- Automatic Tasks.
--
-- Work that falls out of a fund's status rather than being typed by someone. Nobody owns them: they
-- surface in the Weekly Update and anyone can pick one up or comment on it, which is the point —
-- "send the data" is the mandate's job, not one person's.
--
-- Generated on read, like ghosting, because this app has no scheduler. The rules are pure functions
-- of the fundraise entries, so recomputing them is cheap and cannot drift from what they describe.
-- A cron would be a second source of truth that is wrong between runs.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'automatic')),
  -- Which rule made it. Also the deduplication key: one open task per rule per fund.
  ADD COLUMN IF NOT EXISTS auto_rule TEXT,
  ADD COLUMN IF NOT EXISTS fundraise_entry_id UUID
    REFERENCES public.fundraise_entries(id) ON DELETE CASCADE,
  -- When it stopped being nobody's and became somebody's, per the escalation rule below.
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.source IS
  'manual = somebody typed it. automatic = a fundraise rule generated it; nobody owns it until it escalates.';

-- One open automatic task per rule per fund. Without this, every page load would add another.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_open_auto
  ON public.tasks(auto_rule, fundraise_entry_id)
  WHERE source = 'automatic' AND status <> 'Done';

CREATE INDEX IF NOT EXISTS idx_tasks_automatic
  ON public.tasks(org_id) WHERE source = 'automatic';

-- ─── Associates must be able to see them ────────────────────────────────────
-- The existing associate policies are `assignee_id = auth.uid()`, so an unowned task would be
-- invisible to exactly the people whose work this is (§12). These add automatic tasks on top,
-- without widening access to anyone else's manual tasks.
DROP POLICY IF EXISTS "Internal see automatic tasks" ON public.tasks;
CREATE POLICY "Internal see automatic tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    source = 'automatic'
    AND org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );

-- Anyone internal can complete one, because nobody owns it.
DROP POLICY IF EXISTS "Internal complete automatic tasks" ON public.tasks;
CREATE POLICY "Internal complete automatic tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    source = 'automatic'
    AND org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );

-- Comments follow the same rule. §5: being able to say "this is stuck on the fund, not on us" is
-- most of the value of an unowned task.
DROP POLICY IF EXISTS "Internal comment on automatic tasks" ON public.task_comments;
CREATE POLICY "Internal comment on automatic tasks"
  ON public.task_comments FOR ALL TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
    AND EXISTS (
      SELECT 1 FROM public.tasks t
       WHERE t.id = task_comments.task_id AND t.source = 'automatic'
    )
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
    AND EXISTS (
      SELECT 1 FROM public.tasks t
       WHERE t.id = task_comments.task_id AND t.source = 'automatic'
    )
  );

-- ─── The rules ──────────────────────────────────────────────────────────────
-- Four, all confirmed. Each is a window on the entry's status and how long it has held:
--
--   data_requested   any age    "Send data to X"                due +2 days
--   call_request     any age    "Schedule call with X for Y"    due +2 days
--   due_diligence    >10 days   "Follow up with X for Y"        due +2 days
--   deal_sent        7-30 days  "Chase X on Y"                  due +2 days
--
-- The chaser deliberately stops at 30 days, where the fund becomes Ghosted. A dead fund generating
-- a task every week is the noise that makes people stop reading the automatic list at all.
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
        CASE WHEN v_rule = 'data_requested' THEN 'High' ELSE 'Medium' END,
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
