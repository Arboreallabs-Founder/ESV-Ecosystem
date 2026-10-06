-- Earnings follow the whole referral subtree, not just the investors a partner introduced directly.
--
-- get_partner_earnings asked `i.referred_by_partner_id = p_partner_id`, which was the right
-- question while the model was flat. With 20261018000000 it is the wrong one: an investor that
-- Robin's investor introduced has referred_by_partner_id = NULL and referred_by_investor_id set, so
-- that row scored zero and the deal itself often failed the relevance filter entirely — the deal
-- simply did not appear on Robin's earnings page.
--
-- The question is now "which partner is at the ROOT of this investor's chain", answered by the
-- investor_referral_roots view. Everything else is untouched: same fee resolution, same base
-- selector, same split. ESV pays the root partner gross of the investor fee and does not model the
-- division below that — see 20261018000000 for why.
--
-- Worked example, the one this was specified against: Robin -> Investor A -> Investor B. B invests
-- 1 Cr at a 6% investor fee, Robin is on a 50/50 split against the `referred` base. B's earning is
-- 6,00,000; it lands in `referred` because B roots to Robin; Robin's share is 50% of that, i.e.
-- 3,00,000 — 3% of the gross crore. A gets nothing from ESV; whatever A is owed comes out of
-- Robin's 3,00,000 by their own arrangement.

CREATE OR REPLACE FUNCTION public.get_partner_earnings(p_partner_id uuid)
RETURNS TABLE (
  active_deal_id     uuid,
  deal_title         text,
  accepted_at        timestamptz,
  org_total_earning  numeric,
  referred_earning   numeric,
  base_type          text,
  split_pct          numeric,
  share_amount       numeric,
  is_sourced         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role           user_role;
  v_org            uuid;
  v_partner_org    uuid;
  v_standard       numeric;
  v_caller_partner uuid;
BEGIN
  v_role := get_user_role();
  v_org  := get_user_org_id();

  SELECT fp.org_id, fp.success_fee_split_pct INTO v_partner_org, v_standard
  FROM public.franchise_partners fp WHERE fp.id = p_partner_id;
  IF v_partner_org IS NULL THEN RAISE EXCEPTION 'Partner not found'; END IF;

  IF NOT is_super_admin() AND v_partner_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_role = 'franchise_partner' THEN
    SELECT u.franchise_partner_id INTO v_caller_partner FROM public.users u WHERE u.id = auth.uid();
    IF v_caller_partner IS DISTINCT FROM p_partner_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  ELSIF v_role NOT IN ('founder','admin','associate') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH inv_earn AS (
    SELECT
      adi.active_deal_id,
      adi.id AS adi_id,
      -- The only line that changed shape. A direct partner tag is depth 1 in the view, so this one
      -- expression covers both the flat case and the chain; the COALESCE is belt-and-braces for an
      -- investor tagged directly while the view is somehow behind.
      COALESCE(r.root_partner_id, i.referred_by_partner_id) AS root_partner_id,
      COALESCE(SUM(
        CASE WHEN f.is_enabled AND adi.investment_amount IS NOT NULL THEN
          COALESCE(f.rate, NULLIF(regexp_replace(COALESCE(fv.value,''), '[^0-9.]', '', 'g'), '')::numeric, 0)
            / 100.0 * adi.investment_amount
        ELSE 0 END
      ), 0) AS earning
    FROM public.active_deal_investors adi
    JOIN public.investors i ON i.id = adi.investor_id
    LEFT JOIN public.investor_referral_roots r ON r.investor_id = i.id
    LEFT JOIN public.active_deal_investor_fees f ON f.active_deal_investor_id = adi.id
    LEFT JOIN public.active_deal_field_values fv
      ON fv.active_deal_id = adi.active_deal_id AND fv.field_id = f.source_field_id
    GROUP BY adi.active_deal_id, adi.id, r.root_partner_id, i.referred_by_partner_id, adi.investment_amount
  ),
  deal_earn AS (
    SELECT
      ie.active_deal_id,
      SUM(ie.earning) AS org_total,
      SUM(CASE WHEN ie.root_partner_id = p_partner_id THEN ie.earning ELSE 0 END) AS referred,
      BOOL_OR(ie.root_partner_id = p_partner_id) AS has_referred
    FROM inv_earn ie
    GROUP BY ie.active_deal_id
  ),
  sourced AS (
    SELECT ad.id AS active_deal_id
    FROM public.active_deals ad
    JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
    JOIN public.form_links fl ON fl.id = pe.form_link_id
    JOIN public.users u ON u.id = fl.created_by
    WHERE u.franchise_partner_id = p_partner_id
  )
  SELECT
    ad.id,
    pe.title,
    ad.created_at,
    COALESCE(de.org_total, 0)::numeric,
    COALESCE(de.referred, 0)::numeric,
    COALESCE(s.base_type, 'referred'),
    COALESCE(s.split_pct, v_standard)::numeric,
    (COALESCE(s.split_pct, v_standard) / 100.0 *
      CASE WHEN COALESCE(s.base_type,'referred') = 'total'
        THEN COALESCE(de.org_total, 0) ELSE COALESCE(de.referred, 0) END)::numeric,
    (src.active_deal_id IS NOT NULL)
  FROM public.active_deals ad
  JOIN public.pipeline_entries pe ON pe.id = ad.pipeline_entry_id
  JOIN public.pipelines p ON p.id = pe.pipeline_id
  LEFT JOIN deal_earn de ON de.active_deal_id = ad.id
  LEFT JOIN sourced src ON src.active_deal_id = ad.id
  LEFT JOIN public.active_deal_partner_shares s
    ON s.active_deal_id = ad.id AND s.partner_id = p_partner_id
  WHERE p.org_id = v_partner_org
    AND (src.active_deal_id IS NOT NULL OR COALESCE(de.has_referred, false))
  ORDER BY ad.created_at DESC;
END;
$$;

-- ─── The tree, for drawing ──────────────────────────────────────────────────
-- Who may see which tree was settled as: a partner sees the tree rooted at themselves, internal
-- roles see any of them. SECURITY DEFINER because a partner cannot select from investors broadly —
-- that policy pins them to their own directly-referred rows (20260720000000), which is now a
-- strict subset of their subtree and would show them a tree with the branches missing.
--
-- Returns the edges, not a nested object: assembling the nesting in SQL means either a jsonb
-- recursion that is hard to read or a bespoke type, and the client has to walk the list anyway to
-- lay it out.
CREATE OR REPLACE FUNCTION public.get_partner_referral_tree(p_partner_id uuid)
RETURNS TABLE (
  investor_id        uuid,
  investor_name      text,
  service_type       text,
  parent_investor_id uuid,
  depth              int,
  invested_total     numeric,
  deal_count         bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role           user_role;
  v_org            uuid;
  v_partner_org    uuid;
  v_caller_partner uuid;
BEGIN
  v_role := get_user_role();
  v_org  := get_user_org_id();

  SELECT fp.org_id INTO v_partner_org
  FROM public.franchise_partners fp WHERE fp.id = p_partner_id;
  IF v_partner_org IS NULL THEN RAISE EXCEPTION 'Partner not found'; END IF;

  IF NOT is_super_admin() AND v_partner_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Same gate as the earnings function, deliberately: the tree and the money are the same claim
  -- seen two ways, so one must not be readable where the other is not.
  IF v_role = 'franchise_partner' THEN
    SELECT u.franchise_partner_id INTO v_caller_partner FROM public.users u WHERE u.id = auth.uid();
    IF v_caller_partner IS DISTINCT FROM p_partner_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  ELSIF v_role NOT IN ('founder','admin','associate') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.name,
    i.service_type::text,
    i.referred_by_investor_id,
    r.depth,
    COALESCE(agg.total, 0)::numeric,
    COALESCE(agg.n, 0)::bigint
  FROM public.investor_referral_roots r
  JOIN public.investors i ON i.id = r.investor_id
  LEFT JOIN LATERAL (
    SELECT SUM(adi.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors adi
     WHERE adi.investor_id = i.id
  ) agg ON TRUE
  WHERE r.root_partner_id = p_partner_id
  ORDER BY r.depth, i.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_referral_tree(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_referral_tree(uuid) TO authenticated;

-- ─── The chain picker ───────────────────────────────────────────────────────
-- Candidates for "who introduced this investor".
--
-- Only investors already inside some partner's tree can pass credit on: the fee follows the chain
-- to a root partner, and an investor with no root has nobody to pay. Restricting the list here
-- rather than failing at the last step makes the rule visible while someone is still choosing.
--
-- SECURITY DEFINER because it reads investor_referral_roots, which is revoked from authenticated
-- (20261018000000) — the walk crosses rows the caller may not be able to read. It returns names and
-- a root partner name, nothing else, and only to internal roles.
CREATE OR REPLACE FUNCTION public.search_investors_for_chain(p_term TEXT, p_exclude UUID)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  root_partner_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role user_role;
  v_org  uuid;
BEGIN
  v_role := get_user_role();
  v_org  := get_user_org_id();

  IF v_role NOT IN ('founder','admin','associate') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF btrim(coalesce(p_term, '')) = '' OR char_length(btrim(p_term)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.id, i.name, fp.name
  FROM public.investor_referral_roots r
  JOIN public.investors i          ON i.id = r.investor_id
  JOIN public.franchise_partners fp ON fp.id = r.root_partner_id
  WHERE i.name ILIKE '%' || btrim(p_term) || '%'
    AND (p_exclude IS NULL OR i.id <> p_exclude)
    AND (is_super_admin() OR fp.org_id = v_org)
  ORDER BY i.name
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.search_investors_for_chain(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_investors_for_chain(TEXT, UUID) TO authenticated;
