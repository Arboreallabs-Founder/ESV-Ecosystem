-- What the company was worth when the money went in.
--
-- The deal page could say how much was raised and nothing about what it bought. Valuation is the
-- first question an investor asks after the amount, it is on every deck, and in the syndicate
-- workbook it sits at the top of each sheet ("Company Valuation Year of Investment" — 103 Cr on
-- FWDA, 500 Cr on Hesa, 75 Cr on Artment). It had nowhere to live here.
--
-- ─── Why the basis is a column and not a convention ─────────────────────────
-- "103 Cr valuation" means two different things depending on whether the raise is inside it. On a
-- 16 Cr round the gap between pre and post is 16 Cr of company, and the implied stake is 15.5% or
-- 13.4% accordingly. A convention written in a comment gets forgotten; a column gets asked.
--
-- Nullable, because plenty of records will carry a number whose basis nobody wrote down. The deal
-- page shows the implied stake only when the basis is known — an ownership percentage derived from
-- a guess is worse than no percentage.
--
-- The 3x and 10x figures in the workbook are deliberately NOT stored. They are the valuation times
-- three and times ten; storing a multiplication is how two numbers end up disagreeing, and
-- presenting a projection beside a fact is how it gets read as one.

ALTER TABLE public.active_deals
  ADD COLUMN IF NOT EXISTS valuation       NUMERIC,
  ADD COLUMN IF NOT EXISTS valuation_basis TEXT;

DO $$ BEGIN
  ALTER TABLE public.active_deals
    ADD CONSTRAINT active_deals_valuation_basis_check
    CHECK (valuation_basis IS NULL OR valuation_basis IN ('pre', 'post'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.active_deals
    ADD CONSTRAINT active_deals_valuation_nonneg
    CHECK (valuation IS NULL OR valuation >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.active_deals.valuation IS
  'Company valuation at the time of this investment, in rupees. Read with valuation_basis.';
COMMENT ON COLUMN public.active_deals.valuation_basis IS
  'pre or post money. NULL means nobody recorded which, and the page then shows the figure without deriving a stake from it.';

-- ─── Partners see it ────────────────────────────────────────────────────────
-- Same class of fact as the minimum ticket and the external raise (20261021000000): it is in the
-- deck, a partner quotes it, and a partner quoting a stale one is worse than them knowing it.
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
    'total_raise',         d.total_raise,
    'external_raised',     d.external_raised,
    'min_ticket',          d.min_ticket,
    'valuation',           d.valuation,
    'valuation_basis',     d.valuation_basis,
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
    'valuation',           d.valuation,
    'valuation_basis',     d.valuation_basis,
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

-- FWDA Tranche 2, from the workbook it was imported from.
UPDATE public.active_deals d
   SET valuation = 1030000000, valuation_basis = 'pre'
  FROM public.pipeline_entries e
 WHERE e.id = d.pipeline_entry_id
   AND e.title = 'FWDA - Tranche 2'
   AND d.valuation IS NULL;
