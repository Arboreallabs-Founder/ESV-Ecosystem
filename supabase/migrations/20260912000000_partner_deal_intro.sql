-- The company's one-liner, for the share message.
--
-- "Earlyseed Ventures presents this exciting investment opportunity — <intro>" needs the intro, and
-- the intro is companies.one_liner, which a partner cannot read. Same shape as everything else on
-- these two functions: one more field on a projection that already exists, rather than a policy
-- that would hand them the company database.

CREATE OR REPLACE FUNCTION public.get_partner_deal_summary(p_deal_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logo_url',           COALESCE(d.logo_url, c.logo_url),
    'company_name',       c.name,
    -- What the company does, in one line. The only part of its profile a partner gets, and only
    -- because it is the sentence they are being asked to forward.
    'company_one_liner',  c.one_liner,
    'committed_total',    COALESCE(agg.total, 0),
    'commitment_count',   COALESCE(agg.n, 0),
    'assignees',          COALESCE(ass.list, '[]'::jsonb)
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
    'logo_url',           COALESCE(d.logo_url, c.logo_url),
    'company_name',       c.name,
    'company_one_liner',  c.one_liner,
    'committed_total',    COALESCE(agg.total, 0),
    'commitment_count',   COALESCE(agg.n, 0),
    'assignees',          COALESCE(ass.list, '[]'::jsonb)
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
