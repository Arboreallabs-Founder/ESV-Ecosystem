-- Admins can give the second signature on partner attribution too.
--
-- 20260919000000 made the approver a flag rather than a role, on the reasoning that "any founder"
-- would make it whoever opens the Desk first, and the point was that one named person signs a fee
-- off. In practice that named person is a single point of failure: with one flag set, every claim
-- waits on one inbox, and claims that wait stop being filed.
--
-- So founders and admins can now approve as well, alongside anyone still carrying the flag. This is
-- a deliberate loosening of that control, asked for explicitly — recorded here rather than left to
-- be rediscovered, because the original reasoning was sound and whoever reads this next deserves
-- both halves of the argument.
--
-- ─── What has NOT changed, and must not ─────────────────────────────────────
-- apply_partner_attribution still refuses a claim whose coordinator and founder signatures come
-- from the same person. That is the rule doing the real work: two signatures from one person is one
-- signature, and widening who may give the second does not widen how many one person may give. An
-- admin who proposed or coordinated a claim still cannot approve it; a second human is still
-- required for every fee attribution.
--
-- is_sgp_approver is kept rather than dropped. It still means something — it marks who is expected
-- to do this, as opposed to who is permitted to — and it is how an associate can hold the second
-- signature without being an admin.

CREATE OR REPLACE FUNCTION public.sgp_can_approve() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_approver)
$$;

COMMENT ON FUNCTION public.sgp_can_approve() IS
  'Who may give the second signature on an attribution claim: founders, admins, and anyone flagged is_sgp_approver. The one-person-two-signatures rule is enforced separately, in apply_partner_attribution.';
