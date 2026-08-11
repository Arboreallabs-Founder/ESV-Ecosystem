-- The paragraph that goes out with a deal.
--
-- The share message was using companies.one_liner, which is written for a card — "clean-label food
-- brand" tells a colleague scanning a list what a company is, and tells someone being asked to
-- invest nothing at all. This is the sentence or two that does: what they do, why now, why it is
-- worth opening the deck.
--
-- Separate from one_liner rather than replacing it. They are read in different places by different
-- people, and making the card carry two lines of pitch would wreck the list this one-liner exists
-- for.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS share_intro TEXT
    CONSTRAINT companies_share_intro_length CHECK (char_length(share_intro) <= 200);

COMMENT ON COLUMN public.companies.share_intro IS
  'Up to 200 characters, used as the introduction in the WhatsApp share message. Falls back to one_liner.';

-- 200 characters because it is read in a chat window under a heading and above a list of links.
-- Long enough for two real sentences; short enough that nobody scrolls past it, which is the same
-- thing as nobody reading it.

-- ─── The partner projection carries it ──────────────────────────────────────
-- A partner writes none of this and reads all of it: they are the ones forwarding the message. Same
-- shape as every other field on these two functions — one more key on a projection that already
-- exists, rather than a policy handing them the company database.
CREATE OR REPLACE FUNCTION public.get_partner_deal_summary(p_deal_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logo_url',            COALESCE(d.logo_url, c.logo_url),
    'company_name',        c.name,
    'company_one_liner',   c.one_liner,
    -- The written pitch if there is one, the card's one-liner if not. Resolved here so a partner
    -- and an associate looking at the same deal never see different introductions.
    'company_share_intro', COALESCE(NULLIF(btrim(c.share_intro), ''), c.one_liner),
    'committed_total',     COALESCE(agg.total, 0),
    'commitment_count',    COALESCE(agg.n, 0),
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
    AND p.org_id = public.get_user_org_id()
    AND d.visible_to_partners IS NOT FALSE;
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
    'committed_total',     COALESCE(agg.total, 0),
    'commitment_count',    COALESCE(agg.n, 0),
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
    AND p.org_id = public.get_user_org_id()
    AND d.visible_to_partners IS NOT FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_summaries() TO authenticated;
