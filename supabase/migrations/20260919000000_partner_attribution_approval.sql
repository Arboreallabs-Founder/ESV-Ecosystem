-- Two signatures before a partner is credited with anything.
--
-- ─── Why one ledger and not three flows ─────────────────────────────────────
-- A company submitted through a partner's form, an investor referred by a partner, and an admin
-- ticking "referred by" in the company database look like three features. They are one claim:
-- *this partner introduced this, and is therefore owed a fee*. Built as three flows they would be
-- three inboxes with three sets of rules, and the Monday review would jump between screens.
--
-- So: one table every route files into, one queue the SGP Desk reads, one pair of signatures.
--
-- ─── Why the database enforces it and not the screen ────────────────────────
-- Six code paths wrote companies/investors.referred_by_partner_id directly — two edit forms, an
-- insert, and the three referral actions. An approval screen in front of them would be decoration:
-- any of the six still lands the tag, and the retroactive-tagging case is *specifically* the one
-- that goes round the front door.
--
-- So the column is guarded by a trigger (see below), and the only thing permitted to change it is
-- apply_partner_attribution(), which refuses a claim that is not carrying both signatures. It no
-- longer matters what a form sends, or who is logged in: the tag cannot appear without a
-- coordinator and the founder having both said yes.

-- ─── Who signs second ───────────────────────────────────────────────────────
-- A flag rather than the founder role: "any founder" makes it whoever gets there first, and
-- hardcoding one user means nobody can cover when they are away. Mirrors is_sgp_coordinator, which
-- already works this way.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_sgp_approver BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_sgp_approver IS
  'Signs off partner attribution claims after a coordinator. Set for Nimit; add a second when he is away.';

UPDATE public.users SET is_sgp_approver = true
 WHERE lower(email) = 'nimit@earlyseedventures.com';

-- ─── The ledger ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_attribution_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.franchise_partners(id) ON DELETE CASCADE,

  -- Exactly one subject. A claim over nothing, or over both at once, is not a fee anyone can pay.
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES public.investors(id) ON DELETE CASCADE,
  CONSTRAINT one_subject CHECK ((company_id IS NULL) <> (investor_id IS NULL)),

  -- How it arrived. Kept because the Monday call treats them differently: a form submission is a
  -- partner doing what we asked, a retroactive tag is us deciding on their behalf.
  source TEXT NOT NULL CHECK (source IN (
    'form_submission', 'manual_submission', 'investor_referral', 'retroactive_tag'
  )),
  -- Where it came from, when there is one — so the Desk can link back to the submission.
  referral_id UUID REFERENCES public.partner_investor_referrals(id) ON DELETE SET NULL,
  pipeline_entry_id UUID REFERENCES public.pipeline_entries(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending_coordinator'
    CHECK (status IN ('pending_coordinator', 'pending_founder', 'approved', 'rejected')),

  note TEXT,

  proposed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  coordinator_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  coordinator_at TIMESTAMPTZ,
  coordinator_note TEXT,
  founder_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  founder_at TIMESTAMPTZ,
  founder_note TEXT,
  -- Set on rejection at either step, so "why not" survives.
  rejected_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live claim per subject. A second partner claiming the same company is a fee dispute that
-- needs a person; it must not be resolvable by whoever writes last.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attr_claim_one_live_company
  ON public.partner_attribution_claims(company_id)
  WHERE company_id IS NOT NULL AND status <> 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS idx_attr_claim_one_live_investor
  ON public.partner_attribution_claims(investor_id)
  WHERE investor_id IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS idx_attr_claim_open
  ON public.partner_attribution_claims(org_id, status)
  WHERE status IN ('pending_coordinator', 'pending_founder');
CREATE INDEX IF NOT EXISTS idx_attr_claim_partner
  ON public.partner_attribution_claims(partner_id);

-- ─── Applying the tag ───────────────────────────────────────────────────────
-- The only thing in the database allowed to write referred_by_partner_id. SECURITY DEFINER so it
-- keeps a privilege its callers do not have, and it re-checks the claim rather than trusting that
-- the action called it in the right order.
CREATE OR REPLACE FUNCTION public.apply_partner_attribution(p_claim_id UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_attribution_claims%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.partner_attribution_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such claim.'; END IF;
  IF c.status <> 'approved' THEN
    RAISE EXCEPTION 'That claim has not been approved.';
  END IF;
  IF c.founder_by IS NULL THEN
    RAISE EXCEPTION 'A claim needs a founder signature before it can be applied.';
  END IF;
  -- coordinator_at, not coordinator_by. The rows carried in from before approvals existed had a
  -- real coordinator step — an admin did tag them — but no record of who, and demanding an actor
  -- we never captured would make three true claims permanently unapplyable.
  IF c.coordinator_at IS NULL THEN
    RAISE EXCEPTION 'A claim needs a coordinator signature before it can be applied.';
  END IF;
  -- One person cannot be the whole process.
  IF c.coordinator_by IS NOT NULL AND c.coordinator_by = c.founder_by THEN
    RAISE EXCEPTION 'The founder signature must come from someone other than the coordinator who approved it.';
  END IF;

  -- Lifts the guard trigger below, for this transaction only. This function is the one caller
  -- allowed to, which is what makes the trigger a gate rather than an inconvenience.
  PERFORM set_config('app.applying_attribution', 'on', true);

  IF c.company_id IS NOT NULL THEN
    UPDATE public.companies SET referred_by_partner_id = c.partner_id WHERE id = c.company_id;
  ELSE
    UPDATE public.investors SET referred_by_partner_id = c.partner_id WHERE id = c.investor_id;
  END IF;

  PERFORM set_config('app.applying_attribution', 'off', true);
END $$;

REVOKE ALL ON FUNCTION public.apply_partner_attribution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_partner_attribution(UUID) TO authenticated;

-- Taking credit back off a record. Its own function, and its own decision: the trigger blocks
-- clearing the column just as firmly as setting it, and it should — an attribution that can be
-- quietly removed is not one a partner can rely on. Marks the claim rejected in the same breath,
-- so the ledger and the record cannot disagree about who is credited.
CREATE OR REPLACE FUNCTION public.withdraw_partner_attribution(p_claim_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_attribution_claims%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.partner_attribution_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such claim.'; END IF;
  IF btrim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Withdrawing credit needs a reason.';
  END IF;

  PERFORM set_config('app.applying_attribution', 'on', true);

  IF c.company_id IS NOT NULL THEN
    UPDATE public.companies SET referred_by_partner_id = NULL
     WHERE id = c.company_id AND referred_by_partner_id = c.partner_id;
  ELSE
    UPDATE public.investors SET referred_by_partner_id = NULL
     WHERE id = c.investor_id AND referred_by_partner_id = c.partner_id;
  END IF;

  PERFORM set_config('app.applying_attribution', 'off', true);

  UPDATE public.partner_attribution_claims
     SET status = 'rejected', rejected_note = p_reason
   WHERE id = p_claim_id;
END $$;

REVOKE ALL ON FUNCTION public.withdraw_partner_attribution(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_partner_attribution(UUID, TEXT) TO authenticated;

-- ─── Closing the six side doors ─────────────────────────────────────────────
-- A trigger, not a column-level REVOKE.
--
-- REVOKE UPDATE (referred_by_partner_id) would have meant re-granting every *other* column by
-- name — 48 on companies, 34 on investors. Any column added later would then be silently
-- unwritable, and the failure would surface as a permission error in an unrelated feature months
-- from now with nothing pointing back to here. A guard aimed at the one column it is guarding does
-- not rot that way.
--
-- Covers INSERT as well as UPDATE: without that, a record can simply be created pre-tagged, which
-- is precisely what the referral flow used to do.
CREATE OR REPLACE FUNCTION public.guard_partner_attribution() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.applying_attribution', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.referred_by_partner_id IS NOT NULL THEN
      RAISE EXCEPTION 'A partner attribution cannot be set at creation. Create the record, then file a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.referred_by_partner_id IS DISTINCT FROM OLD.referred_by_partner_id THEN
    RAISE EXCEPTION 'Partner attribution is set by approval, not directly. File a claim on the SGP Desk.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

-- Deliberately fires for every caller, service_role and the SQL editor included. Triggers are not
-- bypassed by RLS-bypassing roles, and that is the point: "an admin goes into the database and
-- tags them" is the case this exists for. The escape hatch, for a genuine data fix, is to
-- SET LOCAL app.applying_attribution = 'on' in the same transaction — deliberate, and visible in
-- whatever script does it.
DROP TRIGGER IF EXISTS companies_guard_attribution ON public.companies;
CREATE TRIGGER companies_guard_attribution
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_partner_attribution();

DROP TRIGGER IF EXISTS investors_guard_attribution ON public.investors;
CREATE TRIGGER investors_guard_attribution
  BEFORE INSERT OR UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.guard_partner_attribution();

-- ─── Who sees and decides what ──────────────────────────────────────────────
ALTER TABLE public.partner_attribution_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sgp_can_coordinate() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_coordinator)
$$;

CREATE OR REPLACE FUNCTION public.sgp_can_approve() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_approver)
$$;

-- A partner reads the state of their own claims. Knowing a referral is "with the founder" rather
-- than silence is the difference between trusting the process and going back to WhatsApp.
DROP POLICY IF EXISTS "Partners read own claims" ON public.partner_attribution_claims;
CREATE POLICY "Partners read own claims"
  ON public.partner_attribution_claims FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND partner_id = (SELECT franchise_partner_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Desk reads claims" ON public.partner_attribution_claims;
CREATE POLICY "Desk reads claims"
  ON public.partner_attribution_claims FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() AND public.sgp_can_coordinate());

-- Proposing. Internal only — a partner's own submission files its claim through the server action,
-- which runs as them but sets the row up; a partner cannot hand-write a claim that skips a step.
DROP POLICY IF EXISTS "Internal propose claims" ON public.partner_attribution_claims;
CREATE POLICY "Internal propose claims"
  ON public.partner_attribution_claims FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
    AND status IN ('pending_coordinator', 'pending_founder')
    -- Nobody arrives approved, and nobody writes their own second signature at insert time.
    AND founder_by IS NULL
  );

DROP POLICY IF EXISTS "Desk decides claims" ON public.partner_attribution_claims;
CREATE POLICY "Desk decides claims"
  ON public.partner_attribution_claims FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND (public.sgp_can_coordinate() OR public.sgp_can_approve())
  )
  WITH CHECK (org_id = public.get_user_org_id());

-- ─── What is already tagged ─────────────────────────────────────────────────
-- Three investors carry a partner tag from before any of this existed. They are filed at the
-- founder step rather than grandfathered: an admin did tag them, so the coordinator half is
-- genuinely satisfied, but nobody signed the fee-bearing half. Backfilling them as approved would
-- put three claims in the ledger that no one ever approved.
INSERT INTO public.partner_attribution_claims (
  org_id, partner_id, investor_id, source, status,
  coordinator_by, coordinator_at, coordinator_note
)
SELECT
  i.org_id, i.referred_by_partner_id, i.id, 'retroactive_tag', 'pending_founder',
  NULL, NOW(),
  'Tagged in the database before approvals existed. Carried in for sign-off rather than assumed.'
FROM public.investors i
WHERE i.referred_by_partner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_attribution_claims c
     WHERE c.investor_id = i.id AND c.status <> 'rejected'
  );

INSERT INTO public.partner_attribution_claims (
  org_id, partner_id, company_id, source, status,
  coordinator_by, coordinator_at, coordinator_note
)
SELECT
  c0.org_id, c0.referred_by_partner_id, c0.id, 'retroactive_tag', 'pending_founder',
  NULL, NOW(),
  'Tagged in the database before approvals existed. Carried in for sign-off rather than assumed.'
FROM public.companies c0
WHERE c0.referred_by_partner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_attribution_claims c
     WHERE c.company_id = c0.id AND c.status <> 'rejected'
  );

-- ─── The dead intake table ──────────────────────────────────────────────────
-- partner_companies has had no writer since 20260906 moved intake onto the pipeline, and no UI
-- reader since the Desk stopped rendering it. Renamed rather than dropped: three rows of real
-- partner submissions, and a rename is reversible in a way a DROP is not.
ALTER TABLE IF EXISTS public.partner_companies
  RENAME TO partner_companies_retired_20260919;

COMMENT ON TABLE public.partner_companies_retired_20260919 IS
  'Superseded by pipeline intake (20260906) and attribution claims (20260919). Kept for its three historical rows; safe to drop once nobody wants them.';
