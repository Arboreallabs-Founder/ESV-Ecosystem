-- The shape of the round: what is being raised, what someone else already filled, and the smallest
-- cheque we will take.
--
-- The deal page could say how much had been committed through us and nothing about the round it
-- sits in. Three numbers were missing, and they are the three every investor asks for first:
--
--   * total_raise      — the whole round. 100 Cr.
--   * external_raised  — already committed by a party outside ESV. 70 Cr.
--   * min_ticket       — the smallest cheque into the direct cap. 1 Cr.
--
-- What is actually open is 100 - 70 - (committed through us), and it is derived rather than stored:
-- a fourth column would be a number that disagrees with the investor rows the moment anyone edits
-- one, and the disagreement would be invisible.
--
-- min_ticket and external_raised are visible to every role including partners, by instruction —
-- they are the two facts a partner needs before putting the deal in front of anyone, and a partner
-- quoting a minimum we have changed is worse than them knowing the number.

ALTER TABLE public.active_deals
  ADD COLUMN IF NOT EXISTS total_raise     NUMERIC,
  ADD COLUMN IF NOT EXISTS external_raised NUMERIC,
  ADD COLUMN IF NOT EXISTS min_ticket      NUMERIC;

COMMENT ON COLUMN public.active_deals.total_raise IS
  'The full round being raised, in rupees. NULL where nobody has said yet.';
COMMENT ON COLUMN public.active_deals.external_raised IS
  'Of total_raise, how much is already committed by a party outside ESV. Visible to partners.';
COMMENT ON COLUMN public.active_deals.min_ticket IS
  'Smallest cheque accepted into the direct cap, in rupees. Visible to partners.';

-- Nonsense the form should never send and the database should not hold either way.
DO $$ BEGIN
  ALTER TABLE public.active_deals
    ADD CONSTRAINT active_deals_raise_amounts_nonneg
    CHECK (
      (total_raise     IS NULL OR total_raise     >= 0) AND
      (external_raised IS NULL OR external_raised >= 0) AND
      (min_ticket      IS NULL OR min_ticket      >= 0)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only checked when both are known. Either alone is a legitimate half-filled form; external money
-- exceeding the whole round is not a state to let anyone save.
DO $$ BEGIN
  ALTER TABLE public.active_deals
    ADD CONSTRAINT active_deals_external_within_total
    CHECK (total_raise IS NULL OR external_raised IS NULL OR external_raised <= total_raise);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── The partner projection carries the two public numbers ──────────────────
-- Both functions also move onto partner_can_see_deal (20261020000000), so venture-tier partners get
-- the same answer here as everywhere else. Previously these asked `visible_to_partners IS NOT
-- FALSE` directly, which would have handed a venture partner every deal in the org through the
-- summary while the entry policy correctly refused them the page.
CREATE OR REPLACE FUNCTION public.get_partner_deal_summary(p_deal_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logo_url',            COALESCE(d.logo_url, c.logo_url),
    'company_name',        c.name,
    'company_one_liner',   c.one_liner,
    'company_share_intro', COALESCE(NULLIF(btrim(c.share_intro), ''), c.one_liner),
    'company_website',     c.website,
    'committed_total',     COALESCE(agg.total, 0),
    'commitment_count',    COALESCE(agg.n, 0),
    -- The round, as a partner may describe it to someone. Still no investor rows: a total and a
    -- count, plus the two numbers about the round itself.
    'total_raise',         d.total_raise,
    'external_raised',     d.external_raised,
    'min_ticket',          d.min_ticket,
    'assignees',           COALESCE(ass.list, '[]'::jsonb)
  )
  FROM public.active_deals d
  JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
  JOIN public.pipelines p        ON p.id = e.pipeline_id
  LEFT JOIN public.companies c   ON c.id = e.company_id
  LEFT JOIN LATERAL (
    SELECT SUM(i.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors i
     WHERE i.active_deal_id = d.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'user_id', a.user_id, 'name', u.name, 'photo_url', u.photo_url,
               'designation', u.designation, 'email', u.email, 'phone', u.phone
             ) ORDER BY u.name
           ) AS list
      FROM public.pipeline_entry_assignees a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.entry_id = e.id
  ) ass ON TRUE
  WHERE d.id = p_deal_id
    AND public.get_user_role() = 'franchise_partner'
    AND public.partner_can_see_deal(d.id);
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_summary(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_partner_deal_summaries()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(d.id, jsonb_build_object(
    'logo_url',            COALESCE(d.logo_url, c.logo_url),
    'company_name',        c.name,
    'company_one_liner',   c.one_liner,
    'company_share_intro', COALESCE(NULLIF(btrim(c.share_intro), ''), c.one_liner),
    'company_website',     c.website,
    'committed_total',     COALESCE(agg.total, 0),
    'commitment_count',    COALESCE(agg.n, 0),
    'total_raise',         d.total_raise,
    'external_raised',     d.external_raised,
    'min_ticket',          d.min_ticket,
    'assignees',           COALESCE(ass.list, '[]'::jsonb)
  )), '{}'::jsonb)
  FROM public.active_deals d
  JOIN public.pipeline_entries e ON e.id = d.pipeline_entry_id
  JOIN public.pipelines p        ON p.id = e.pipeline_id
  LEFT JOIN public.companies c   ON c.id = e.company_id
  LEFT JOIN LATERAL (
    SELECT SUM(i.investment_amount) AS total, COUNT(*) AS n
      FROM public.active_deal_investors i
     WHERE i.active_deal_id = d.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'user_id', a.user_id, 'name', u.name, 'photo_url', u.photo_url,
               'designation', u.designation, 'email', u.email, 'phone', u.phone
             ) ORDER BY u.name
           ) AS list
      FROM public.pipeline_entry_assignees a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.entry_id = e.id
  ) ass ON TRUE
  WHERE public.get_user_role() = 'franchise_partner'
    AND public.partner_can_see_deal(d.id);
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_summaries() TO authenticated;
