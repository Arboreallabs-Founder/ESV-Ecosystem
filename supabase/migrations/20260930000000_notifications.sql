-- Notifications: one table for every "something happened that involves you".
--
-- This reverses a decision written down in 20260814700000_approvals_notify_founders.sql, which
-- said founder-notify-on-approval reused the escalations table "rather than a new notifications
-- table". That was the right call when exactly one flow needed it. Six flows need it now, and the
-- gap it leaves is worse than untidy: the person who asks for leave is never told whether it was
-- approved. Nothing in the app tells them. So the table earns its place, and the escalations reuse
-- is retired — notify_founders_of_approval's rows become notifications like everything else.
--
-- The other half of the reason is the phone. The sidebar bell's "seen" marker is a localStorage
-- timestamp, which is per-browser by construction: read it on a laptop and the phone still shows
-- the badge. Once there are iOS and Android clients that is a daily annoyance rather than a
-- footnote, and read state has to live server-side. It lives here, in read_at.
--
-- kind is TEXT + CHECK rather than an enum on purpose: ALTER TYPE ... ADD VALUE cannot run in the
-- transaction that then uses the value, and pasting into the SQL editor gives us exactly one
-- transaction. 20260917000000 and 20260926000000 both made the same call for the same reason.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Who it is for. CASCADE: an unread pile belonging to someone who has left is not a record of
  -- anything, unlike the edit logs, which is why those keep their author and this does not.
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Who caused it. SET NULL so "Priya commented" survives Priya being deleted, degrading to
  -- "Someone commented" rather than taking the row with it.
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  kind TEXT NOT NULL CHECK (kind IN (
    'task_assigned', 'task_reassigned', 'task_comment',
    'leave_submitted', 'leave_decided',
    'expense_submitted', 'expense_decided',
    'kudos_received', 'escalation_raised', 'approval_recorded',
    'bulletin_posted', 'event_posted'
  )),

  title TEXT NOT NULL,
  body TEXT,

  -- Where clicking it goes, stored rather than derived from kind + an id. The bell renders a link;
  -- it does not know what a task is, and should not have to learn what the next twelve kinds are.
  -- Generalises the ?open= deep link the task board already reads.
  link TEXT,

  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS
  'One row per person per event. The sidebar bell reads this; push notifications will read it too.';

-- The question the layout asks on every single navigation is "how many unread for me". Partial, so
-- that count never walks the read pile, which is the part that grows forever.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- The list, once the bell is actually opened.
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─── Read: yours, and only yours ────────────────────────────────────────────
-- Deliberately no founder/admin oversight branch, unlike escalations. What someone has not yet
-- read is not managerial data, and the *_edit_log tables already carry the audit trail of what
-- actually happened. The check is role-independent, so every role reaches their own — including
-- franchise_partner, who has no org-wide user read at all.
DROP POLICY IF EXISTS "Read own notifications" ON public.notifications;
CREATE POLICY "Read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

-- ─── Write: any internal user, addressed to anyone in their org ─────────────
-- Mirrors the escalations INSERT policy: the row is pinned to the writer's own org and the writer
-- cannot forge who it came from, but the recipient is deliberately unconstrained. An associate who
-- comments on a founder's task has to be able to tell that founder about it, and a general user
-- submitting leave has to be able to tell the approvers.
DROP POLICY IF EXISTS "Internal write notifications" ON public.notifications;
CREATE POLICY "Internal write notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

-- ─── Why marking read is a function and not an UPDATE policy ────────────────
-- RLS grants rows, never columns — the same wall 20260927000000 hit. An UPDATE policy scoped to
-- user_id = auth.uid() would also let a recipient rewrite title, body and link on their own
-- notifications, which would make this table useless as the record of what a person was actually
-- told. Marking read is the only write a recipient needs, so it is the only write they get.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- SECURITY DEFINER means RLS is not filtering this for us; the user_id predicate is doing that
  -- work, and dropping it would let anyone mark anyone's notifications read.
  UPDATE public.notifications
     SET read_at = NOW()
   WHERE id = ANY(p_ids)
     AND user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
     SET read_at = NOW()
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID[]) FROM PUBLIC;
-- anon named explicitly: REVOKE FROM PUBLIC does not remove Supabase's own grant to that role,
-- which is how withdraw_partner_attribution once ended up callable by anybody.
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ─── push_tokens ────────────────────────────────────────────────────────────
-- Nothing writes to this yet: there is no phone to register a token until the Capacitor clients
-- exist. It is here now so that adding push later is additive — one function body fills in, rather
-- than a migration plus a revisit of every call site that ever notifies anybody.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- One row per device token. A reinstall issues a new token and abandons the old one; the only
  -- way to learn a token is dead is for a send to fail against it, so stale rows are cleared then.
  token TEXT NOT NULL UNIQUE,

  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),

  -- Touched on every app open, so an obviously abandoned device can be told apart from a quiet one.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.push_tokens IS
  'Device push tokens, one row per device. Unused until the iOS/Android clients ship.';

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Your own devices, all four commands. A device registers, re-registers and deregisters itself;
-- nobody else has any business reading which phones a colleague carries.
DROP POLICY IF EXISTS "Manage own push tokens" ON public.push_tokens;
CREATE POLICY "Manage own push tokens"
  ON public.push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND org_id = public.get_user_org_id());

-- Deliberately no DELETE policy on notifications and no purge job. 20260914000000 states that there
-- is no scheduler in this app, and every other append-only table here — the edit logs, task_pushes,
-- fundraise_events, deal_stage_history — grows unbounded on the same terms. Introducing pg_cron for
-- this one table would be the estate's first scheduler, and a notification nobody can delete is the
-- same trade every one of those tables already made.
