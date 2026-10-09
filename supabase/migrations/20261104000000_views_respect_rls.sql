-- Supabase advisor: "Security Definer View" on three views.
--
-- A Postgres view runs with its OWNER's permissions by default, so row-level security on the tables
-- underneath is evaluated for the owner (who bypasses it), not for whoever is querying. Supabase
-- also grants SELECT on new public views to `anon` and `authenticated`, and the anon key ships in the
-- browser bundle. So, as defined, these were readable through the REST API by anyone:
--
--   investor_rejections          every fund that passed on a deal, the company, sector and the
--                                written reason (20260914, rebuilt 20260917)
--   investor_angel_interactions  every angel reach-out: angel, company, method, who did it, response
--                                (20260917)
--   partner_visible_deal_fields  which deal fields partners can see (20260905); configuration only
--
-- security_invoker makes each view evaluate RLS as the caller, so it returns exactly what the
-- caller could already read from the tables themselves: internal roles see their org's rows,
-- partners and anonymous callers see nothing extra. None of the three is used by the app (they are
-- reporting helpers), so nothing changes there. Anonymous access is revoked as well, belt and
-- braces: no anonymous caller has a reason to read any of them.

ALTER VIEW public.investor_rejections          SET (security_invoker = true);
ALTER VIEW public.investor_angel_interactions  SET (security_invoker = true);
ALTER VIEW public.partner_visible_deal_fields  SET (security_invoker = true);

REVOKE ALL ON public.investor_rejections          FROM anon;
REVOKE ALL ON public.investor_angel_interactions  FROM anon;
REVOKE ALL ON public.partner_visible_deal_fields  FROM anon;
