-- Two things a founder review turned out to need once it met a real founder.
--
-- 1. They name funds they want ADDED, not only ones to avoid. The list was built as a veto — tick
--    off the ones you object to — and founders keep replying "also try X, Y and Z". That answer
--    was landing in email, which is the exact place this feature exists to get things out of.
--
-- 2. Both sides need to edit after the link has gone out. Today adding a fund means unsharing
--    first, and unsharing takes the founder's page offline mid-review: get_investor_list_public
--    only serves a 'shared' list, so their open tab starts erroring while we work.

-- ─── 1. The founder's own names, in both directions ─────────────────────────
-- A kind column rather than a second table. An exclusion and a suggestion are the same object with
-- the sign flipped: a name typed from memory that somebody here has to match against a fund we
-- actually hold before it can be acted on. Same lifecycle, same matching step, same RLS — splitting
-- them would mean maintaining that matching workflow twice and rendering two near-identical queues.
--
-- The table name is now half right. Left alone deliberately: renaming it would break every policy
-- reference and every line of code that reads it in the window between this migration running and
-- the new build deploying, and the comment below is cheaper than that risk.
ALTER TABLE public.investor_list_exclusions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'exclude'
    CHECK (kind IN ('exclude', 'include'));

COMMENT ON TABLE public.investor_list_exclusions IS
  'Free-text names from the founder, in both directions. kind=exclude is do-not-approach; kind=include is a fund they asked us to add. Historical name — see 20260921.';

COMMENT ON COLUMN public.investor_list_exclusions.kind IS
  'exclude = do not approach. include = the founder asked us to add this one.';

CREATE INDEX IF NOT EXISTS idx_list_exclusions_kind
  ON public.investor_list_exclusions(list_id, kind);

-- ─── 2. The founder's submission carries suggestions too ────────────────────
-- Kept as one call. A founder pressing submit is making one statement about the whole list; two
-- round trips would let half of it land.
CREATE OR REPLACE FUNCTION public.submit_investor_list_response(
  p_token uuid,
  p_unapproved uuid[],
  p_exclusions jsonb DEFAULT '[]'::jsonb,
  p_note TEXT DEFAULT NULL,
  p_suggestions jsonb DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_list public.investor_lists%ROWTYPE;
BEGIN
  SELECT * INTO v_list FROM public.investor_lists WHERE share_token = p_token AND status = 'shared';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Everything ticked, then the named ones cleared. Doing it in that order means a re-submission
  -- replaces the previous answer rather than merging with it — which is also what makes the
  -- founder's "change my answer" route safe to offer.
  UPDATE public.investor_list_items
     SET approved = true, decided_at = NOW()
   WHERE list_id = v_list.id;

  UPDATE public.investor_list_items
     SET approved = false, decided_at = NOW()
   WHERE list_id = v_list.id
     AND id = ANY(COALESCE(p_unapproved, '{}'));

  -- Unmatched rows are replaced wholesale; matched ones survive, because somebody here has already
  -- done the work of tying that name to a real fund and a re-submission should not undo it.
  DELETE FROM public.investor_list_exclusions
   WHERE list_id = v_list.id AND matched_at IS NULL AND kind = 'exclude';
  INSERT INTO public.investor_list_exclusions (org_id, list_id, raw_name, reason, kind)
  SELECT v_list.org_id, v_list.id,
         btrim(x->>'name'), NULLIF(btrim(COALESCE(x->>'reason', '')), ''), 'exclude'
    FROM jsonb_array_elements(COALESCE(p_exclusions, '[]'::jsonb)) x
   WHERE length(btrim(COALESCE(x->>'name', ''))) > 0;

  DELETE FROM public.investor_list_exclusions
   WHERE list_id = v_list.id AND matched_at IS NULL AND kind = 'include';
  INSERT INTO public.investor_list_exclusions (org_id, list_id, raw_name, reason, kind)
  SELECT v_list.org_id, v_list.id,
         btrim(x->>'name'), NULLIF(btrim(COALESCE(x->>'reason', '')), ''), 'include'
    FROM jsonb_array_elements(COALESCE(p_suggestions, '[]'::jsonb)) x
   WHERE length(btrim(COALESCE(x->>'name', ''))) > 0;

  UPDATE public.investor_lists
     SET responded_at = NOW(), founder_note = NULLIF(btrim(COALESCE(p_note, '')), '')
   WHERE id = v_list.id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.submit_investor_list_response(uuid, uuid[], jsonb, TEXT, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_investor_list_response(uuid, uuid[], jsonb, TEXT, jsonb) TO anon, authenticated;

-- The four-argument version has to go, and it is safe for it to.
--
-- The currently deployed build calls this with four named arguments. PostgREST passes arguments by
-- name, and Postgres resolves a four-name call against the five-parameter function because the
-- fifth carries a default -- so a founder pressing submit between this migration running and the
-- new build deploying still lands on the new function and still saves.
--
-- The drop is what makes that true: leaving both would give the four-name call two candidates and
-- Postgres would refuse it as ambiguous. So the old signature is not being retired for tidiness,
-- it is being removed because keeping it is what would break the window.
DROP FUNCTION IF EXISTS public.submit_investor_list_response(uuid, uuid[], jsonb, TEXT);

-- ─── 3. What the founder reads back ─────────────────────────────────────────
-- Adds their own note plus per-item decided_at, so a fund added after they responded can be marked
-- as new rather than appearing silently pre-ticked.
--
-- No column for "added since". Every item gets decided_at stamped on submit, so an item with a
-- NULL decided_at on a list that has already been responded to *is* one that arrived afterwards.
-- Derived rather than stored, so it cannot drift out of step with the thing it describes.
DROP FUNCTION IF EXISTS public.get_investor_list_public(uuid);
CREATE FUNCTION public.get_investor_list_public(p_token uuid)
RETURNS TABLE (
  list_id UUID, list_name TEXT, intro_note TEXT, status TEXT, responded_at TIMESTAMPTZ,
  founder_note TEXT, deal_name TEXT,
  item_id UUID, investor_name TEXT, investor_website TEXT, approved BOOLEAN,
  decided_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id, l.name, l.intro_note, l.status::TEXT, l.responded_at, l.founder_note,
    COALESCE(c.name, e.title, 'this deal'),
    i.id, inv.name, inv.website, i.approved, i.decided_at
  FROM public.investor_lists l
  JOIN public.active_deals ad ON ad.id = l.active_deal_id
  LEFT JOIN public.pipeline_entries e ON e.id = ad.pipeline_entry_id
  LEFT JOIN public.companies c ON c.id = e.company_id
  LEFT JOIN public.investor_list_items i ON i.list_id = l.id
  LEFT JOIN public.investors inv ON inv.id = i.investor_id
  WHERE l.share_token = p_token
    AND l.status = 'shared'
  ORDER BY i.sort_order, inv.name;
$$;

REVOKE ALL ON FUNCTION public.get_investor_list_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_investor_list_public(uuid) TO anon, authenticated;

-- Their own names back, so a second visit does not show them an empty form and ask them to
-- remember what they already said.
CREATE OR REPLACE FUNCTION public.get_investor_list_names(p_token uuid)
RETURNS TABLE (name TEXT, reason TEXT, kind TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.raw_name, x.reason, x.kind
    FROM public.investor_list_exclusions x
    JOIN public.investor_lists l ON l.id = x.list_id
   WHERE l.share_token = p_token AND l.status = 'shared'
   ORDER BY x.kind, x.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_investor_list_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_investor_list_names(uuid) TO anon, authenticated;
