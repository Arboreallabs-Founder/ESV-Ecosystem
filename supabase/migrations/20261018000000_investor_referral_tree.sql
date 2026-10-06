-- Investor referrals that branch: a partner brings an investor, that investor brings another.
--
-- Until now an investor had exactly one credit column, referred_by_partner_id, so the model was
-- flat: every introduction was partner -> investor, one hop, and anything deeper had nowhere to go.
-- In practice a partner's best introductions introduce people themselves, and those arrived as
-- either a second direct tag on the partner (losing who actually made the introduction) or nothing
-- at all.
--
-- ─── The money, so the shape is clear ──────────────────────────────────────
-- ESV pays the ROOT PARTNER gross and does not model anything below that. If Robin introduces
-- Investor A, and A introduces B, and B invests 1 Cr at a 6% investor fee with Robin on a 50/50
-- split, Robin is owed 3% of the 1 Cr. How Robin and A then divide that is between them, and is
-- deliberately not represented here: a split we do not pay is a number we would get wrong.
--
-- So the tree exists to answer one question — which partner is at the root of this investor? — and
-- the earnings function (20261019000000) asks exactly that.

-- ─── The edge ───────────────────────────────────────────────────────────────
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS referred_by_investor_id UUID
    REFERENCES public.investors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.investors.referred_by_investor_id IS
  'The investor who introduced this one. Credit rolls up the chain to the root partner; ESV pays that partner gross. Mutually exclusive with referred_by_partner_id, which marks a root.';

-- At most one parent. Both set would be two answers to "who is at the root", and the two can
-- disagree; an investor introduced by another investor inherits the root rather than restating it.
DO $$ BEGIN
  ALTER TABLE public.investors
    ADD CONSTRAINT investors_one_referrer
    CHECK (referred_by_partner_id IS NULL OR referred_by_investor_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.investors
    ADD CONSTRAINT investors_no_self_referral
    CHECK (referred_by_investor_id IS DISTINCT FROM id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Walking up the chain happens on every earnings calculation, so the edge is indexed in the
-- direction the walk reads it.
CREATE INDEX IF NOT EXISTS idx_investors_referred_by_investor
  ON public.investors(referred_by_investor_id)
  WHERE referred_by_investor_id IS NOT NULL;

-- ─── Cycles ─────────────────────────────────────────────────────────────────
-- A -> B -> A has no root, so every earnings query over that component would recurse until the
-- statement is killed. A CHECK cannot see other rows, so this is a trigger: it walks up from the
-- proposed parent and refuses if it arrives back at the row being written.
--
-- The depth cap is a second floor under the same hole. If a cycle ever does get in — a restore, a
-- direct fix — it stops queries hanging rather than leaving the fund database unqueryable.
CREATE OR REPLACE FUNCTION public.guard_investor_referral_cycle() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cursor UUID;
  v_depth  INT := 0;
BEGIN
  IF NEW.referred_by_investor_id IS NULL THEN RETURN NEW; END IF;

  v_cursor := NEW.referred_by_investor_id;
  WHILE v_cursor IS NOT NULL LOOP
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'That introduction loops back on itself: % already sits above this investor in the chain.',
        (SELECT name FROM public.investors WHERE id = NEW.referred_by_investor_id)
        USING ERRCODE = 'check_violation';
    END IF;

    v_depth := v_depth + 1;
    IF v_depth > 32 THEN
      RAISE EXCEPTION 'Referral chain is too deep to be real (over 32 links). Check the chain above this investor.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT referred_by_investor_id INTO v_cursor
      FROM public.investors WHERE id = v_cursor;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS investors_guard_referral_cycle ON public.investors;
CREATE TRIGGER investors_guard_referral_cycle
  BEFORE INSERT OR UPDATE OF referred_by_investor_id ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.guard_investor_referral_cycle();

-- ─── Root resolution ────────────────────────────────────────────────────────
-- The one question the tree exists to answer. STABLE and SECURITY DEFINER: the walk crosses rows
-- the caller may not be able to read (a partner can see their own investors, not the whole chain),
-- and it returns a single partner id, never the names along the way.
CREATE OR REPLACE FUNCTION public.investor_root_partner(p_investor_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH RECURSIVE up AS (
    SELECT i.id, i.referred_by_partner_id, i.referred_by_investor_id, 1 AS depth
      FROM public.investors i WHERE i.id = p_investor_id
    UNION ALL
    SELECT i.id, i.referred_by_partner_id, i.referred_by_investor_id, up.depth + 1
      FROM public.investors i
      JOIN up ON i.id = up.referred_by_investor_id
     WHERE up.depth < 32
  )
  SELECT referred_by_partner_id FROM up
   WHERE referred_by_partner_id IS NOT NULL
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.investor_root_partner(UUID) IS
  'The partner at the root of this investor''s referral chain, or NULL if the chain never reaches one. This is who ESV pays, gross; nothing below the root is modelled.';

-- The same walk for every investor at once. The earnings function joins this rather than calling
-- investor_root_partner per row, which would be one recursive query per investor on the deal.
CREATE OR REPLACE VIEW public.investor_referral_roots AS
  WITH RECURSIVE down AS (
    -- Roots: investors a partner introduced directly.
    SELECT i.id AS investor_id, i.referred_by_partner_id AS root_partner_id, 1 AS depth
      FROM public.investors i
     WHERE i.referred_by_partner_id IS NOT NULL
    UNION ALL
    -- Everyone hanging off them, inheriting the root.
    SELECT c.id, d.root_partner_id, d.depth + 1
      FROM public.investors c
      JOIN down d ON c.referred_by_investor_id = d.investor_id
     WHERE d.depth < 32
  )
  SELECT investor_id, root_partner_id, depth FROM down;

COMMENT ON VIEW public.investor_referral_roots IS
  'Every investor that rolls up to a partner, with the root partner and how many links away. Depth 1 is a direct partner introduction. Not readable directly — see the REVOKE below.';

-- Nobody queries this view directly.
--
-- It is deliberately NOT security_invoker: the walk has to cross rows the caller cannot read, or a
-- partner gets a tree with the branches missing. That makes it an RLS bypass by construction, and
-- Supabase grants `authenticated` broad table privileges by default — so left open, this view would
-- hand any signed-in partner the entire org's referral graph, which is the one thing the investor
-- policies exist to prevent.
--
-- The SECURITY DEFINER functions that use it run as the owner and are unaffected by this revoke.
-- They are the only supported way in, and each re-checks the caller itself.
REVOKE ALL ON public.investor_referral_roots FROM PUBLIC, anon, authenticated;

-- ─── The guard, extended ────────────────────────────────────────────────────
-- referred_by_investor_id decides which partner gets paid just as surely as referred_by_partner_id
-- does — it is the same decision reached one hop further along. 20260919 closed every direct write
-- to the first column; leaving the second open would reopen the hole with an extra step, since
-- tagging an investor under one of Robin's investors credits Robin exactly as tagging them under
-- Robin would.
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
    -- companies has no referred_by_investor_id; TG_TABLE_NAME keeps one trigger function serving
    -- both tables rather than forking it.
    IF TG_TABLE_NAME = 'investors' AND NEW.referred_by_investor_id IS NOT NULL THEN
      RAISE EXCEPTION 'An investor cannot be created already placed under another investor. Create the record, then file a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.referred_by_partner_id IS DISTINCT FROM OLD.referred_by_partner_id THEN
      RAISE EXCEPTION 'Partner attribution is set by approval, not directly. File a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF TG_TABLE_NAME = 'investors'
       AND NEW.referred_by_investor_id IS DISTINCT FROM OLD.referred_by_investor_id THEN
      RAISE EXCEPTION 'Who introduced an investor is set by approval, not directly. File a claim on the SGP Desk.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- ─── Claims can now name an introducing investor ────────────────────────────
-- partner_id stays NOT NULL and keeps meaning "who gets paid". On a chain claim it is the root
-- partner, resolved and then re-checked at apply time, so the fee destination is recorded on the
-- claim rather than inferred later from a tree that may have moved since.
ALTER TABLE public.partner_attribution_claims
  ADD COLUMN IF NOT EXISTS referrer_investor_id UUID
    REFERENCES public.investors(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.partner_attribution_claims.referrer_investor_id IS
  'Set when the claim is "this investor was introduced by that investor". partner_id is then the root partner of the referrer, who is the one actually paid.';

ALTER TABLE public.partner_attribution_claims
  DROP CONSTRAINT IF EXISTS partner_attribution_claims_source_check;
ALTER TABLE public.partner_attribution_claims
  ADD CONSTRAINT partner_attribution_claims_source_check
  CHECK (source IN (
    'form_submission', 'manual_submission', 'investor_referral', 'retroactive_tag', 'investor_chain'
  ));

-- A referrer only makes sense for an investor subject, and never for itself.
DO $$ BEGIN
  ALTER TABLE public.partner_attribution_claims
    ADD CONSTRAINT attr_claim_referrer_is_investor_subject
    CHECK (referrer_investor_id IS NULL OR investor_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Guarded on the referrer being present, not written as IS DISTINCT FROM.
--
-- `referrer_investor_id IS DISTINCT FROM investor_id` reads like the same rule and is not: on a
-- COMPANY claim both columns are NULL, and NULL IS DISTINCT FROM NULL is false — so the constraint
-- rejected every company claim already in the table. The rule only has anything to say once a
-- referrer is actually named.
DO $$ BEGIN
  ALTER TABLE public.partner_attribution_claims
    ADD CONSTRAINT attr_claim_referrer_not_self
    CHECK (referrer_investor_id IS NULL OR referrer_investor_id <> investor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Applying a claim, with the chain case ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_partner_attribution(p_claim_id UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_attribution_claims%ROWTYPE;
  v_root UUID;
BEGIN
  SELECT * INTO c FROM public.partner_attribution_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such claim.'; END IF;
  IF c.status <> 'approved' THEN
    RAISE EXCEPTION 'That claim has not been approved.';
  END IF;
  IF c.founder_by IS NULL THEN
    RAISE EXCEPTION 'A claim needs a founder signature before it can be applied.';
  END IF;
  IF c.coordinator_at IS NULL THEN
    RAISE EXCEPTION 'A claim needs a coordinator signature before it can be applied.';
  END IF;
  IF c.coordinator_by IS NOT NULL AND c.coordinator_by = c.founder_by THEN
    RAISE EXCEPTION 'The founder signature must come from someone other than the coordinator who approved it.';
  END IF;

  PERFORM set_config('app.applying_attribution', 'on', true);

  IF c.company_id IS NOT NULL THEN
    UPDATE public.companies SET referred_by_partner_id = c.partner_id WHERE id = c.company_id;

  ELSIF c.referrer_investor_id IS NOT NULL THEN
    -- Re-checked at the moment of writing, not trusted from when the claim was filed. The referrer
    -- may have been re-rooted, or detached entirely, between the two signatures — and this write is
    -- what starts the money moving.
    v_root := public.investor_root_partner(c.referrer_investor_id);
    IF v_root IS NULL THEN
      RAISE EXCEPTION 'The introducing investor no longer rolls up to any partner, so there is nobody to credit. Re-file the claim once their own chain is settled.';
    END IF;
    IF v_root IS DISTINCT FROM c.partner_id THEN
      RAISE EXCEPTION 'The introducing investor now roots to a different partner than this claim was approved for. Reject it and file it again against the current chain.';
    END IF;

    -- Placed under the referrer, NOT tagged with the partner. The root is what the chain resolves
    -- to; writing both would be the one state investors_one_referrer forbids, and the two could
    -- later disagree.
    UPDATE public.investors
       SET referred_by_investor_id = c.referrer_investor_id,
           referred_by_partner_id  = NULL
     WHERE id = c.investor_id;

  ELSE
    UPDATE public.investors
       SET referred_by_partner_id  = c.partner_id,
           referred_by_investor_id = NULL
     WHERE id = c.investor_id;
  END IF;

  PERFORM set_config('app.applying_attribution', 'off', true);
END $$;

REVOKE ALL ON FUNCTION public.apply_partner_attribution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_partner_attribution(UUID) TO authenticated;

-- ─── Withdrawing one ────────────────────────────────────────────────────────
-- Detaching a node orphans its whole subtree from the root partner: those investors stop rolling
-- up to anyone and drop out of that partner's earnings. That is the correct reading of "this
-- introduction was not real", but it is a bigger gesture than withdrawing a leaf, so the subtree
-- stays attached to the detached investor rather than being silently re-parented onto the partner.
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
  ELSIF c.referrer_investor_id IS NOT NULL THEN
    UPDATE public.investors SET referred_by_investor_id = NULL
     WHERE id = c.investor_id AND referred_by_investor_id = c.referrer_investor_id;
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
