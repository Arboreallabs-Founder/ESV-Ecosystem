-- Two holes from the 13 Aug audit, both at the database boundary.
--
-- ─── Why these two together ─────────────────────────────────────────────────
-- Separately they read as a config slip and a stale policy. Chained they are a path from a
-- constant committed in the repo to every row in the other tenant:
--
--   the demo PIN signs you in as a *founder* of the demo org
--     -> a founder may UPDATE any user in their org, and no policy constrained the `role` column
--       -> set yourself super_admin
--         -> is_super_admin() bypasses org scoping across the RLS estate
--           -> both organisations live in this one project
--
-- The demo gate is closed in application code (src/app/actions/demo.ts). This migration closes the
-- step after it, so the chain stays broken even if a founder account is obtained some other way —
-- which is the step that actually matters, because a tenant founder is not supposed to be able to
-- reach the other tenant by any route at all.

-- ─── 1. Nobody grants themselves the platform role ──────────────────────────
-- A trigger rather than a policy. RLS decides which *rows* a caller may write, never which columns
-- or which values — the existing "Org admins update user roles" policy is correct about the row and
-- silent about the role, which is exactly how this was reachable.
CREATE OR REPLACE FUNCTION public.guard_role_escalation() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Deliberate platform administration, e.g. seeding the first super admin or a considered fix in
  -- the SQL editor: SET LOCAL app.allow_super_admin = 'on' in the same transaction. Visible in
  -- whatever script does it, which is the point — this should never be incidental.
  IF current_setting('app.allow_super_admin', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER so this reads the caller's own row regardless of what RLS would show them.
  -- ::TEXT because users.role is the user_role enum and comparing an enum to a text variable is
  -- the kind of thing that only fails once there is real data in the table.
  SELECT role::TEXT INTO v_caller_role FROM public.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::TEXT = 'super_admin' AND coalesce(v_caller_role, '') <> 'super_admin' THEN
      RAISE EXCEPTION 'Only a super admin can create a super admin.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Becoming a super admin. Demotion is left alone: removing the role is not an escalation, and a
  -- founder who can revoke a stale platform account is a smaller problem than one who cannot.
  IF NEW.role::TEXT = 'super_admin'
     AND OLD.role::TEXT IS DISTINCT FROM 'super_admin'
     AND coalesce(v_caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can grant the super admin role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Moving a user between organisations is the same escalation wearing a different hat: put your
  -- own row in the other tenant and every org-scoped policy starts answering yes.
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     AND coalesce(v_caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can move a user between organisations.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

-- Fires for service_role and the SQL editor as well. That is intended: the create-user Edge
-- Function runs with the service key and takes a caller-supplied role, so it is one of the callers
-- this needs to bind. Creating an ordinary user is untouched — only the super_admin value and
-- org_id changes are gated.
DROP TRIGGER IF EXISTS users_guard_role_escalation ON public.users;
CREATE TRIGGER users_guard_role_escalation
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_role_escalation();

-- approved_emails is the allowlist a signup reads its role from, so an unguarded row here becomes a
-- super admin at first login — the same escalation, just deferred.
CREATE OR REPLACE FUNCTION public.guard_approved_email_role() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF current_setting('app.allow_super_admin', true) = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT role::TEXT INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF NEW.role::TEXT = 'super_admin' AND coalesce(v_caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can pre-approve a super admin.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS approved_emails_guard_role ON public.approved_emails;
CREATE TRIGGER approved_emails_guard_role
  BEFORE INSERT OR UPDATE ON public.approved_emails
  FOR EACH ROW EXECUTE FUNCTION public.guard_approved_email_role();

-- ─── 2. Bearer tokens stop being a public list ──────────────────────────────
-- "Anon read form links by token" was USING (true) — not "by token" at all, but every row in the
-- table, tokens included. A token that anyone can enumerate is not a secret, and the whole public
-- form model rests on it being one.
--
-- Safe to drop: the renderer reads through get_public_form(), which is SECURITY DEFINER and so does
-- not consult RLS, and every other read of this table in application code runs authenticated.
-- Checked before writing this, not assumed.
DROP POLICY IF EXISTS "Anon read form links by token" ON public.form_links;

-- The policy was the reachable half; the grant is what made it reachable. Revoked so a future
-- permissive policy cannot quietly re-open the table to anonymous callers.
REVOKE ALL ON public.form_links FROM anon;

COMMENT ON TABLE public.form_links IS
  'Bearer tokens for public forms. Anonymous access is through get_public_form()/submit RPCs only — never direct table reads. See 20260920.';

-- ─── 3. Repairing a tag this work removed ───────────────────────────────────
-- Verifying the audit meant attempting each attack against the live database and expecting a
-- refusal. On the unpatched database they succeeded, so the probe did what it was testing for: it
-- called withdraw_partner_attribution as an anonymous caller, which cleared Meridian Angel
-- Network's partner tag and rejected its claim.
--
-- The claim was restored immediately. The tag could not be, because the guard from 20260919
-- correctly refuses a direct write from anywhere except apply_partner_attribution — and that
-- function requires a founder signature this claim has not got. Fabricating one to tidy up would
-- be the exact dishonesty the ledger exists to prevent, so the repair lives here instead, where
-- lifting the guard is explicit and reviewable.
--
-- Scoped to the rows the 20260919 backfill created, by their own note. Those claims were generated
-- *from* already-tagged investors, so the tag existing is what put them in the ledger.
SET LOCAL app.applying_attribution = 'on';

UPDATE public.investors i
   SET referred_by_partner_id = c.partner_id
  FROM public.partner_attribution_claims c
 WHERE c.investor_id = i.id
   AND i.referred_by_partner_id IS NULL
   AND c.status <> 'rejected'
   AND c.coordinator_note = 'Tagged in the database before approvals existed. Carried in for sign-off rather than assumed.';

SET LOCAL app.applying_attribution = 'off';
