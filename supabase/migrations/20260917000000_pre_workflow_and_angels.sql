-- The rest of the fundraise brief: getting to a contact before the workflow starts, the two
-- connected-introduction paths, and Angel Reachout for syndicate deals.
--
-- ─── Why the status column changes type ─────────────────────────────────────
-- Nine new statuses sit *before* the nine that already exist. Adding them to the enum means
-- ALTER TYPE ... ADD VALUE, which cannot be used in the same transaction that adds it — so a
-- migration that adds a value and then writes a function referencing it fails in the SQL editor,
-- which runs everything in one transaction.
--
-- The column becomes TEXT with a CHECK instead. Same guarantees, no transaction trap, and adding
-- the next status is a one-line constraint change rather than a two-migration dance. Safe to do
-- now: there are no fundraise entries yet.

ALTER TABLE public.fundraise_entries
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE TEXT USING status::TEXT,
  ALTER COLUMN status SET DEFAULT 'not_sent';

ALTER TABLE public.fundraise_events
  ALTER COLUMN from_status TYPE TEXT USING from_status::TEXT,
  ALTER COLUMN to_status   TYPE TEXT USING to_status::TEXT;

DROP TYPE IF EXISTS fundraise_status;

-- The full set, in the order a fund travels through them.
ALTER TABLE public.fundraise_entries
  DROP CONSTRAINT IF EXISTS fundraise_entries_status_check,
  ADD CONSTRAINT fundraise_entries_status_check CHECK (status IN (
    -- Before anything can be sent: we hold no reachable contact at this fund (§9).
    'no_contact', 'reaching_out', 'converted_poc',
    -- The POC is a connection of one of the founders (§10).
    'sent_to_founder', 'founder_connected', 'founder_looped_in',
    -- The POC is a connection of a partner (§11). The partner stays tagged for the fee.
    'sent_to_partner', 'partner_connected', 'partner_looped_in',
    -- The regular workflow.
    'not_sent', 'deal_sent', 'data_requested', 'call_request',
    'due_diligence', 'accepted', 'rejected', 'closed'
  ));

-- ─── Who established the contact ────────────────────────────────────────────
-- §9: the system records whoever made the connection. Without this, "converted to POC" says a
-- contact exists but not who to thank or ask about it.
ALTER TABLE public.fundraise_entries
  ADD COLUMN IF NOT EXISTS poc_established_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poc_established_at TIMESTAMPTZ,
  -- Which introduction route this fund is on, so the pre-workflow statuses mean something specific.
  ADD COLUMN IF NOT EXISTS intro_route TEXT
    CHECK (intro_route IN ('direct', 'founder', 'partner', 'new_contact'));

-- ─── Tagging a fund's contact to a founder or a partner ─────────────────────
-- On the contact, not the fund: a fund can have several people at it, and only one of them is
-- Monica's connection. Putting it on the fund would lose which person the relationship is with.
ALTER TABLE public.investor_contacts
  ADD COLUMN IF NOT EXISTS connected_partner_id UUID
    REFERENCES public.franchise_partners(id) ON DELETE SET NULL,
  -- Hardcoded for now, per the decision: these five are the founders whose networks we route
  -- through. When it should become a real relation, this column is where to look.
  ADD COLUMN IF NOT EXISTS connected_founder TEXT
    CHECK (connected_founder IS NULL OR connected_founder IN (
      'Monica Gupta', 'Manan Patel', 'Nimit Shah', 'Rahul Hingmire', 'Sudhir Mehta'
    ));

COMMENT ON COLUMN public.investor_contacts.connected_partner_id IS
  'The partner who knows this person. Fees are attributed from here, so it survives the fund changing hands internally.';

CREATE INDEX IF NOT EXISTS idx_investor_contacts_connected_partner
  ON public.investor_contacts(connected_partner_id) WHERE connected_partner_id IS NOT NULL;

-- ─── Angel Reachout ─────────────────────────────────────────────────────────
-- Syndicate deals only, and internal only (§13). Angels do not run an institutional process, so
-- this is not a status funnel — it is "who reached out, how, when, and what came back" (§16).
--
-- One list is one collaborative task rather than a task per investor: forty angels would otherwise
-- be forty cards nobody can see the shape of.
CREATE TABLE IF NOT EXISTS public.angel_reachout_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,

  method TEXT NOT NULL CHECK (method IN ('in_person', 'whatsapp', 'email', 'other')),
  -- Required by the action when method is 'other'. "Other" with no detail is a record of nothing.
  method_other TEXT,

  title TEXT,
  -- The one collaborative task everyone assigned works through.
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_angel_lists_deal ON public.angel_reachout_lists(active_deal_id);

CREATE TABLE IF NOT EXISTS public.angel_reachout_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.angel_reachout_lists(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,

  -- Everyone starts included (§15); unticking is how you narrow it.
  included BOOLEAN NOT NULL DEFAULT true,

  -- Ticked off as outreach happens, by whoever did it — several people work one list at once.
  done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,

  -- What came back. Free text on purpose (§16): an angel's reply does not fit a status.
  response TEXT,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_angel_members_list ON public.angel_reachout_members(list_id);
CREATE INDEX IF NOT EXISTS idx_angel_members_investor ON public.angel_reachout_members(investor_id);

ALTER TABLE public.angel_reachout_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.angel_reachout_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal manage angel lists" ON public.angel_reachout_lists;
CREATE POLICY "Internal manage angel lists"
  ON public.angel_reachout_lists FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'));

DROP POLICY IF EXISTS "Internal manage angel members" ON public.angel_reachout_members;
CREATE POLICY "Internal manage angel members"
  ON public.angel_reachout_members FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─── Building a list ────────────────────────────────────────────────────────
-- Every angel investor in the book, all ticked (§15). Funds are excluded: this is the angel
-- network, and a fund on it would end up in two different outreach processes at once.
CREATE OR REPLACE FUNCTION public.seed_angel_reachout(p_list_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_added INT;
BEGIN
  SELECT org_id INTO v_org FROM public.angel_reachout_lists WHERE id = p_list_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'That reachout list no longer exists.'; END IF;

  WITH inserted AS (
    INSERT INTO public.angel_reachout_members (org_id, list_id, investor_id)
    SELECT v_org, p_list_id, i.id
      FROM public.investors i
     WHERE i.org_id = v_org
       AND i.service_type = 'angel_investor'
    ON CONFLICT (list_id, investor_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_added FROM inserted;
  RETURN v_added;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_angel_reachout(UUID) TO authenticated;

-- ─── Angel interactions enrich the investor's profile ───────────────────────
-- §17: once a response is in, it belongs against that investor rather than only inside the list it
-- came from. A view rather than a copy, so it cannot drift from what was actually recorded.
CREATE OR REPLACE VIEW public.investor_angel_interactions AS
  SELECT
    m.investor_id,
    inv.name                      AS investor_name,
    COALESCE(c.name, pe.title)    AS company_name,
    l.active_deal_id,
    l.method,
    l.method_other,
    m.done,
    m.done_at,
    u.name                        AS reached_out_by,
    m.response,
    m.responded_at
  FROM public.angel_reachout_members m
  JOIN public.angel_reachout_lists l ON l.id = m.list_id
  JOIN public.investors inv          ON inv.id = m.investor_id
  JOIN public.active_deals d         ON d.id = l.active_deal_id
  JOIN public.pipeline_entries pe    ON pe.id = d.pipeline_entry_id
  LEFT JOIN public.companies c       ON c.id = pe.company_id
  LEFT JOIN public.users u           ON u.id = m.done_by
  WHERE m.included;

-- ─── Two more automatic rules ───────────────────────────────────────────────
-- The pre-workflow paths need chasing like anything else: a fund waiting on an introduction that
-- nobody follows up is the failure mode §9 and §10 exist to prevent. Same shape as the four
-- confirmed rules — a window on the status and how long it has held.
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
           EXTRACT(EPOCH FROM (NOW() - fe.status_changed_at)) / 86400 AS days_held
      FROM public.fundraise_entries fe
      JOIN public.fundraise_lists l   ON l.id = fe.list_id
      JOIN public.investors inv       ON inv.id = fe.investor_id
      JOIN public.active_deals d      ON d.id = l.active_deal_id
      JOIN public.pipeline_entries pe ON pe.id = d.pipeline_entry_id
      LEFT JOIN public.companies c    ON c.id = pe.company_id
     WHERE fe.status IN (
       'data_requested', 'call_request', 'due_diligence', 'deal_sent',
       'reaching_out', 'sent_to_founder', 'sent_to_partner'
     )
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

    ELSIF r.status = 'deal_sent' AND r.days_held > 7 AND r.days_held <= 30 THEN
      v_rule  := 'deal_sent_no_reply';
      v_title := format('Chase %s on %s', r.fund_name, r.company_name);

    -- A contact search nobody returns to is the deal never reaching the fund at all.
    ELSIF r.status = 'reaching_out' AND r.days_held > 7 THEN
      v_rule  := 'poc_search_stalled';
      v_title := format('Still no contact at %s — keep looking', r.fund_name);

    -- An introduction waiting on someone is the easiest thing in this process to forget.
    ELSIF r.status IN ('sent_to_founder', 'sent_to_partner') AND r.days_held > 7 THEN
      v_rule  := 'intro_waiting';
      v_title := format('Chase the introduction to %s for %s', r.fund_name, r.company_name);
    END IF;

    IF v_rule IS NOT NULL THEN
      INSERT INTO public.tasks (
        org_id, title, description, status, priority, due_date,
        source, auto_rule, fundraise_entry_id
      )
      VALUES (
        r.org_id, v_title,
        format('Raised automatically because %s has been at "%s" for %s day(s).',
               r.fund_name, replace(r.status, '_', ' '), floor(r.days_held)),
        'To Do',
        (CASE WHEN v_rule = 'data_requested' THEN 'High' ELSE 'Medium' END)::task_priority,
        (NOW() + INTERVAL '2 days')::DATE,
        'automatic', v_rule, r.id
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN v_made := v_made + 1; END IF;
    END IF;
  END LOOP;

  UPDATE public.tasks t
     SET status = 'Done', completed_at = COALESCE(t.completed_at, NOW())
    FROM public.fundraise_entries fe
   WHERE t.fundraise_entry_id = fe.id
     AND t.source = 'automatic'
     AND t.status <> 'Done'
     AND (
       (t.auto_rule = 'data_requested'           AND fe.status <> 'data_requested')
       OR (t.auto_rule = 'call_request'          AND fe.status <> 'call_request')
       OR (t.auto_rule = 'due_diligence_stalled' AND fe.status <> 'due_diligence')
       OR (t.auto_rule = 'poc_search_stalled'    AND fe.status <> 'reaching_out')
       OR (t.auto_rule = 'intro_waiting'
             AND fe.status NOT IN ('sent_to_founder', 'sent_to_partner'))
       OR (t.auto_rule = 'deal_sent_no_reply' AND (fe.status <> 'deal_sent'
             OR fe.status_changed_at < NOW() - INTERVAL '30 days'))
     );

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

-- is_fundraise_ghosted took the enum; it takes TEXT now. Ghosting still applies only to the four
-- statuses where a fund could actually be ignoring us — an introduction we are waiting on is our
-- problem, not theirs, and calling it "ghosted" would point the blame the wrong way.
DROP FUNCTION IF EXISTS public.is_fundraise_ghosted(fundraise_status, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.is_fundraise_ghosted(
  p_status TEXT,
  p_status_changed_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_status IN ('deal_sent', 'data_requested', 'call_request', 'due_diligence')
     AND p_status_changed_at < NOW() - INTERVAL '30 days';
$$;

-- The founder's view casts status to text already; recreate it so it no longer references the type.
CREATE OR REPLACE FUNCTION public.get_fundraise_public(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'list_id',      l.id,
    'company_name', COALESCE(c.name, e.title),
    'shared_at',    l.shared_at,
    'entries', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'name')
        FROM (
          SELECT jsonb_build_object(
            'id',           fe.id,
            'name',         inv.name,
            'website',      inv.website,
            'status',       CASE WHEN public.is_fundraise_ghosted(fe.status, fe.status_changed_at)
                                 THEN 'ghosted' ELSE fe.status END,
            'status_since', fe.status_changed_at,
            'rejection_reason', fe.rejection_reason,
            'updates', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'id', ev.id, 'kind', ev.kind, 'body', ev.body,
                       'author', ev.author_label, 'at', ev.created_at
                     ) ORDER BY ev.created_at)
                FROM public.fundraise_events ev
               WHERE ev.entry_id = fe.id AND ev.founder_visible
            ), '[]'::jsonb)
          ) AS x
          FROM public.fundraise_entries fe
          JOIN public.investors inv ON inv.id = fe.investor_id
          WHERE fe.list_id = l.id
        ) s
    ), '[]'::jsonb)
  )
  FROM public.fundraise_lists l
  JOIN public.active_deals d      ON d.id = l.active_deal_id
  JOIN public.pipeline_entries e  ON e.id = d.pipeline_entry_id
  LEFT JOIN public.companies c    ON c.id = e.company_id
  WHERE l.share_token = p_token
    AND l.shared_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_fundraise_public(TEXT) TO anon, authenticated;
