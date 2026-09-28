-- Opens the associate-referral pipeline/form (20261007000000) to every ESV team member, not just
-- associates — same mechanism, wider audience: a link anyone on the team can post on LinkedIn or
-- send directly, that comes back credited to them. The internal column/flag names stay
-- `is_associate_*` (renaming them now buys nothing and risks more than it saves); what changes is
-- who the UI offers a link to, and the public-facing copy, since founders/admins/general/hr can now
-- share it too and the wording said "associate" to the person filling it in.

-- ─── Re-word the public-facing copy ──────────────────────────────────────────
-- form_title/form_description are shown to the anonymous person filling the form in
-- (src/app/f/[token]/page.tsx) — this was never internal-only text.
UPDATE public.forms
SET
  title = 'Refer to Earlyseed Ventures',
  description = 'Know a founder raising, or want to introduce someone to ESV? Tell us a bit about '
    || 'them and it reaches our team directly.'
WHERE is_associate_form;

-- The pipeline name is internal (shown on the Kanban board and in the admin links list), but
-- "Associate Sourced" is no longer accurate once every role can source through it.
UPDATE public.pipelines
SET
  name = 'ESV Referrals',
  description = 'Companies referred by anyone on the team, however they arrived — typed in '
    || 'directly or through someone''s referral link. Everything lands at Lead.'
WHERE is_associate_intake;

-- ─── Provision a link for everyone who's here right now ─────────────────────
-- One-time backfill, not an ongoing job: someone who joins after this migration gets their link
-- the normal way, the first time they open the referrals page (getOrCreateMyAssociateReferralLink
-- is already idempotent and already open to all five internal roles — see 20261007000000).
DO $$
DECLARE
  v_form   RECORD;
  v_user   RECORD;
BEGIN
  FOR v_form IN SELECT id, org_id FROM public.forms WHERE is_associate_form LOOP
    FOR v_user IN
      SELECT id, name FROM public.users
      WHERE org_id = v_form.org_id AND role IN ('founder', 'admin', 'associate', 'general', 'hr')
    LOOP
      INSERT INTO public.form_links (form_id, created_by, label)
      SELECT v_form.id, v_user.id, COALESCE(NULLIF(v_user.name, ''), 'Referral') || ' — referrals'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.form_links fl
        WHERE fl.form_id = v_form.id AND fl.created_by = v_user.id
      );
    END LOOP;
  END LOOP;
END $$;

-- ─── Everyone's links, in one place ──────────────────────────────────────────
-- No new RLS needed: "Org internal form links access" (20260924000000) already lets founder/admin
-- read every form_link in their org, not just their own — the admin overview page just queries
-- that, scoped to this one form_id, and the app-layer page gate (founder/admin) decides who
-- actually gets to look. Noted here rather than left implicit, since it's easy to assume a new
-- feature needs a new policy and add one that only widens what an associate can already read.
