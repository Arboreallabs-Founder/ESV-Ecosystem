-- The Fundraise Status List.
--
-- What happens after a founder approves an investor list. Each approved fund becomes a row we work
-- and track: where it has got to, everything that has happened to it, and — for the small subset we
-- choose to expose — what the founder sees.
--
-- Two audiences, one table. The founder is shown the major status, the updates we mark as theirs,
-- and any rejection reason. We keep the full history. That split is enforced by a column on each
-- event rather than by two tables, because the alternative is writing everything twice and having
-- the two versions disagree.
--
-- Its own share token, deliberately separate from the investor list's. They answer different
-- questions at different times, and a founder holding one link that silently changes meaning after
-- they approve is worse than holding two that each do one thing.

-- ─── Major status ───────────────────────────────────────────────────────────
-- Eight stored values. "Ghosted" is the ninth the team talks about and is NOT stored: it is derived
-- from how long a fund has sat still, so it can never disagree with the timeline it is read from,
-- and the moment anything moves it stops being true on its own. See is_fundraise_ghosted().
CREATE TYPE fundraise_status AS ENUM (
  'not_sent',        -- approved, nothing sent yet
  'deal_sent',
  'data_requested',  -- the fund asked us for something
  'call_request',
  'due_diligence',
  'accepted',
  'rejected',        -- they replied no, and said why
  'closed'           -- ended for any other reason
);

CREATE TABLE IF NOT EXISTS public.fundraise_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,

  -- The founder's link. Separate from investor_lists.share_token on purpose.
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  shared_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,

  -- The outreach email the team agreed for this mandate, shown at the top of the internal list so
  -- whoever sends the next one copies the approved wording instead of writing their own.
  reachout_template TEXT,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One per deal. Two would mean two founder links to the same thing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundraise_lists_deal
  ON public.fundraise_lists(active_deal_id);

CREATE TABLE IF NOT EXISTS public.fundraise_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.fundraise_lists(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,

  status fundraise_status NOT NULL DEFAULT 'not_sent',

  -- When the status last actually changed. This is the ghosting clock, and it is a separate column
  -- from updated_at on purpose: a comment or a logged call must not reset it, or a fund nobody has
  -- heard from would look alive because we talked about it among ourselves.
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Why they said no. Required by the action when moving to 'rejected' — "they passed" with no
  -- reason is the answer that teaches us nothing and cannot enrich the fund's profile.
  rejection_reason TEXT,
  -- What they were rejecting: usually the company's sector, kept so the fund's profile can
  -- accumulate "passed on D2C, twice" without re-deriving it later.
  rejection_sector TEXT,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (list_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_fundraise_entries_list ON public.fundraise_entries(list_id);
CREATE INDEX IF NOT EXISTS idx_fundraise_entries_investor ON public.fundraise_entries(investor_id);

-- ─── The timeline ───────────────────────────────────────────────────────────
-- Everything that has happened to a fund on this mandate. Status changes are written here too, so
-- the history is one list rather than a status column plus a separate note trail that has to be
-- read together to make sense.
CREATE TABLE IF NOT EXISTS public.fundraise_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.fundraise_entries(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN (
    'status_change', 'outreach', 'follow_up', 'note', 'request', 'response', 'founder_comment'
  )),
  body TEXT,
  from_status fundraise_status,
  to_status fundraise_status,

  -- The line between the two audiences. Default false: an event nobody has classified stays
  -- internal, which is the safe direction for a table that will mostly hold our own working notes.
  -- A founder_comment is theirs, so it is always visible to them.
  founder_visible BOOLEAN NOT NULL DEFAULT false,

  -- Null for a founder comment: they have no account, and the token is what authorises them.
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraise_events_entry
  ON public.fundraise_events(entry_id, created_at DESC);

-- ─── Ghosted, derived ───────────────────────────────────────────────────────
-- Thirty days since the status last changed, and only while the fund is actually in flight. A fund
-- never sent cannot ghost us, and neither can one that already accepted, rejected or closed.
CREATE OR REPLACE FUNCTION public.is_fundraise_ghosted(
  p_status fundraise_status,
  p_status_changed_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_status IN ('deal_sent', 'data_requested', 'call_request', 'due_diligence')
     AND p_status_changed_at < NOW() - INTERVAL '30 days';
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Associate-level work, so associates get the same access as founders and admins. Partners are not
-- part of this: it is the mandate being worked, not a referral being tracked.
ALTER TABLE public.fundraise_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraise_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraise_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal manage fundraise lists" ON public.fundraise_lists;
CREATE POLICY "Internal manage fundraise lists"
  ON public.fundraise_lists FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'));

DROP POLICY IF EXISTS "Internal manage fundraise entries" ON public.fundraise_entries;
CREATE POLICY "Internal manage fundraise entries"
  ON public.fundraise_entries FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'));

DROP POLICY IF EXISTS "Internal manage fundraise events" ON public.fundraise_events;
CREATE POLICY "Internal manage fundraise events"
  ON public.fundraise_events FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate'));

-- ─── Seeding from an approved investor list ─────────────────────────────────
-- Every fund the founder approved becomes an entry. Idempotent, so running it again after the team
-- adds more names picks up only the new ones — which is the normal case, since §2 says names get
-- added from our end after approval.
CREATE OR REPLACE FUNCTION public.sync_fundraise_from_investor_list(p_list_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deal UUID;
  v_org UUID;
  v_fund_list UUID;
  v_added INT;
BEGIN
  SELECT active_deal_id, org_id INTO v_deal, v_org
    FROM public.investor_lists WHERE id = p_list_id;
  IF v_deal IS NULL THEN
    RAISE EXCEPTION 'That investor list no longer exists.';
  END IF;

  SELECT id INTO v_fund_list FROM public.fundraise_lists WHERE active_deal_id = v_deal;
  IF v_fund_list IS NULL THEN
    INSERT INTO public.fundraise_lists (org_id, active_deal_id, created_by)
    VALUES (v_org, v_deal, auth.uid())
    RETURNING id INTO v_fund_list;
  END IF;

  WITH inserted AS (
    INSERT INTO public.fundraise_entries (org_id, list_id, investor_id, sort_order)
    SELECT v_org, v_fund_list, i.investor_id, i.sort_order
      FROM public.investor_list_items i
     WHERE i.list_id = p_list_id
       AND i.approved
    ON CONFLICT (list_id, investor_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_added FROM inserted;

  RETURN v_added;
END $$;

GRANT EXECUTE ON FUNCTION public.sync_fundraise_from_investor_list(UUID) TO authenticated;

-- ─── The founder's view ─────────────────────────────────────────────────────
-- The founder has no account; the token is the key. SECURITY DEFINER because they must read rows
-- RLS would refuse them, and the function is what decides exactly how much: the major status, the
-- events we marked as theirs, and the rejection reason. Never the internal timeline.
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
            -- Derived, not stored, so it can never disagree with the timeline.
            'status',       CASE WHEN public.is_fundraise_ghosted(fe.status, fe.status_changed_at)
                                 THEN 'ghosted' ELSE fe.status::TEXT END,
            'status_since', fe.status_changed_at,
            'rejection_reason', fe.rejection_reason,
            'updates', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'id', ev.id, 'kind', ev.kind, 'body', ev.body,
                       'author', ev.author_label, 'at', ev.created_at
                     ) ORDER BY ev.created_at)
                FROM public.fundraise_events ev
               WHERE ev.entry_id = fe.id
                 AND ev.founder_visible
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

-- A founder leaves a comment against one fund. Their only write, and it is append-only: they
-- cannot edit or delete, because the value of the record is that it says what was said and when.
CREATE OR REPLACE FUNCTION public.add_fundraise_founder_comment(
  p_token TEXT, p_entry_id UUID, p_body TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  IF btrim(COALESCE(p_body, '')) = '' THEN
    RAISE EXCEPTION 'Write something first.';
  END IF;

  -- The token must own the entry. Without this check a valid token for one mandate could comment
  -- on any fund on any other.
  SELECT fe.org_id INTO v_org
    FROM public.fundraise_entries fe
    JOIN public.fundraise_lists l ON l.id = fe.list_id
   WHERE fe.id = p_entry_id
     AND l.share_token = p_token
     AND l.shared_at IS NOT NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'That link does not have access to this fund.';
  END IF;

  INSERT INTO public.fundraise_events (org_id, entry_id, kind, body, founder_visible, author_label)
  VALUES (v_org, p_entry_id, 'founder_comment', btrim(p_body), true, 'Founder');
END $$;

GRANT EXECUTE ON FUNCTION public.add_fundraise_founder_comment(TEXT, UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_fundraise_viewed(p_token TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.fundraise_lists
     SET first_viewed_at = COALESCE(first_viewed_at, NOW())
   WHERE share_token = p_token AND shared_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_fundraise_viewed(TEXT) TO anon, authenticated;

-- ─── Rejections enrich the fund's profile ───────────────────────────────────
-- The point of capturing a reason is that it accumulates. This view answers "what has this fund
-- passed on, and why" without anyone re-deriving it from the mandates later.
CREATE OR REPLACE VIEW public.investor_rejections AS
  SELECT
    fe.investor_id,
    inv.name          AS investor_name,
    COALESCE(c.name, pe.title) AS company_name,
    fe.rejection_sector,
    fe.rejection_reason,
    fe.status_changed_at AS rejected_at,
    l.active_deal_id
  FROM public.fundraise_entries fe
  JOIN public.fundraise_lists l  ON l.id = fe.list_id
  JOIN public.investors inv      ON inv.id = fe.investor_id
  JOIN public.active_deals d     ON d.id = l.active_deal_id
  JOIN public.pipeline_entries pe ON pe.id = d.pipeline_entry_id
  LEFT JOIN public.companies c   ON c.id = pe.company_id
  WHERE fe.status = 'rejected'
    AND fe.rejection_reason IS NOT NULL;
