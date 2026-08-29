-- Letting a partner clear a referral off their own list.
--
-- ─── The rule this has to not break ─────────────────────────────────────────
-- 20260910 says, in as many words: "Deliberately no partner UPDATE or DELETE. Withdrawing a
-- referral after we have acted on it rewrites who introduced whom, which is the one fact this table
-- exists to hold."
--
-- That still holds for a decided referral. It is the record of who introduced whom and when, and
-- what we said back — the thing two partners' competing claims would be settled against. A partner
-- being able to erase it is a partner being able to erase the evidence.
--
-- It does not hold for a pending one. Nobody has acted on it, nothing has been decided, and it is
-- their own submission sitting in a queue. Deleting that loses nothing.
--
-- So: pending is deleted, decided is hidden. One gesture for the partner, two behaviours, and the
-- fee record survives either way.
ALTER TABLE public.partner_investor_referrals
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.partner_investor_referrals.dismissed_at IS
  'The partner cleared a decided referral off their own view. The row stays: it is the record of who introduced whom. Coordinators still see it.';

-- ─── Why a function rather than a policy ────────────────────────────────────
-- RLS grants rows, never columns. A partner UPDATE policy on this table would let them write
-- status, investor_id and decision_note as well as dismissed_at — which is to say it would let them
-- mark their own referral accepted. There is no narrower policy to write, so the write happens
-- inside a function that only does the one thing.
CREATE OR REPLACE FUNCTION public.remove_investor_referral(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.partner_investor_referrals%ROWTYPE;
  v_partner UUID;
BEGIN
  SELECT * INTO r FROM public.partner_investor_referrals WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That referral no longer exists.';
  END IF;

  -- Theirs, and only theirs. SECURITY DEFINER means RLS is not doing this check for us.
  SELECT franchise_partner_id INTO v_partner FROM public.users WHERE id = auth.uid();
  IF v_partner IS NULL OR v_partner IS DISTINCT FROM r.partner_id THEN
    RAISE EXCEPTION 'That is not your referral.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF r.status = 'pending' THEN
    DELETE FROM public.partner_investor_referrals WHERE id = p_id;
    RETURN 'deleted';
  END IF;

  UPDATE public.partner_investor_referrals SET dismissed_at = NOW() WHERE id = p_id;
  RETURN 'hidden';
END $$;

REVOKE ALL ON FUNCTION public.remove_investor_referral(UUID) FROM PUBLIC;
-- anon named explicitly: REVOKE FROM PUBLIC does not remove Supabase's own grant to that role, which
-- is how withdraw_partner_attribution ended up callable by anybody. Not repeating it here.
REVOKE ALL ON FUNCTION public.remove_investor_referral(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_investor_referral(UUID) TO authenticated;
