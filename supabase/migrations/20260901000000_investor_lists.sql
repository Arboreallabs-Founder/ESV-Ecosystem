-- Investor lists: a shortlist of funds a founder approves before we approach anyone.
--
-- The flow: an associate builds a list on an IB deal, sends the founder a link, and the founder
-- unticks anyone they do not want approached — plus names anyone they want left alone that we have
-- not thought of. Today that conversation happens over email and the answer is not written down
-- anywhere the outreach can be checked against.
--
-- Funds only, never angel investors, and only on deals tagged Investment Banking. Both rules are
-- enforced here rather than left to the UI: sending a founder's cap table plans to an angel who
-- knows them personally is the kind of mistake that has to be structurally impossible.

DO $$ BEGIN
  CREATE TYPE investor_list_status AS ENUM ('draft', 'shared', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Lists ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investor_lists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  active_deal_id UUID NOT NULL REFERENCES public.active_deals(id) ON DELETE CASCADE,

  name           TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  status         investor_list_status NOT NULL DEFAULT 'draft',

  -- The founder's link. Random, unguessable, and revocable by clearing it — the page is public,
  -- so the token is the only thing standing between a stranger and the shortlist.
  share_token    UUID UNIQUE DEFAULT gen_random_uuid(),
  shared_at      TIMESTAMPTZ,
  -- What the founder sees above the list. Deliberately not the internal notes.
  intro_note     TEXT,

  -- Set the first time the founder opens it and the first time they submit, so "have they looked
  -- at it yet" is answerable without asking them.
  first_viewed_at   TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,
  founder_note      TEXT,

  created_by     UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_lists_deal ON public.investor_lists(active_deal_id);
CREATE INDEX IF NOT EXISTS idx_investor_lists_token ON public.investor_lists(share_token) WHERE share_token IS NOT NULL;

DROP TRIGGER IF EXISTS investor_lists_set_updated_at ON public.investor_lists;
CREATE TRIGGER investor_lists_set_updated_at
  BEFORE UPDATE ON public.investor_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Items ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investor_list_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  list_id     UUID NOT NULL REFERENCES public.investor_lists(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,

  -- Everything starts ticked: the founder is removing objections, not building a list from
  -- scratch. An empty list they have to fill in is a list that comes back empty.
  approved    BOOLEAN NOT NULL DEFAULT true,
  -- Set when the founder actually touches the row, so "approved because they said so" is
  -- distinguishable from "approved because nobody unticked it".
  decided_at  TIMESTAMPTZ,
  founder_note TEXT,

  -- Internal only; never rendered on the public page.
  internal_note TEXT,
  sort_order  INT NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_list_items_list ON public.investor_list_items(list_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_investor_list_items_investor ON public.investor_list_items(investor_id);

-- ─── The founder's own exclusions ───────────────────────────────────────────
-- Names the founder does not want approached that are not on our list at all — an existing
-- investor, a competitor's backer, someone they fell out with. Free text because the founder is
-- typing from memory; investor_id is filled in by us afterwards when the name matches something we
-- hold, which is what makes it enforceable rather than just noted.
CREATE TABLE IF NOT EXISTS public.investor_list_exclusions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  list_id     UUID NOT NULL REFERENCES public.investor_lists(id) ON DELETE CASCADE,

  raw_name    TEXT NOT NULL CHECK (length(btrim(raw_name)) > 0),
  reason      TEXT,
  -- Linked by us, not by the founder. NULL means "we could not find who they meant", which is a
  -- state worth being able to see and chase.
  investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  matched_by  UUID REFERENCES public.users(id),
  matched_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_list_exclusions_list ON public.investor_list_exclusions(list_id);
CREATE INDEX IF NOT EXISTS idx_list_exclusions_unmatched
  ON public.investor_list_exclusions(list_id) WHERE investor_id IS NULL;

-- ─── Guards ─────────────────────────────────────────────────────────────────

-- Only on deals tagged Investment Banking. Enforced in the database because the UI gate can be
-- bypassed by anything that writes directly, and this decides who receives a founder's raise plans.
CREATE OR REPLACE FUNCTION public.deal_is_investment_banking(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.active_deal_categories adc
    JOIN public.deal_categories dc ON dc.id = adc.category_id
    WHERE adc.active_deal_id = p_deal_id
      AND lower(btrim(dc.name)) = 'investment banking'
  );
$$;

CREATE OR REPLACE FUNCTION public.investor_lists_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.deal_is_investment_banking(NEW.active_deal_id) THEN
    RAISE EXCEPTION 'Investor lists can only be built on deals tagged Investment Banking.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS investor_lists_ib_only ON public.investor_lists;
CREATE TRIGGER investor_lists_ib_only
  BEFORE INSERT OR UPDATE OF active_deal_id ON public.investor_lists
  FOR EACH ROW EXECUTE FUNCTION public.investor_lists_check();

-- Funds only. An angel is a person, often one the founder knows, and a shortlist of funds is not
-- the place to put them.
CREATE OR REPLACE FUNCTION public.investor_list_items_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_type TEXT;
BEGIN
  SELECT service_type::TEXT INTO v_type FROM public.investors WHERE id = NEW.investor_id;
  IF v_type = 'angel_investor' THEN
    RAISE EXCEPTION 'Investor lists are for funds. Angel investors cannot be added.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS investor_list_items_funds_only ON public.investor_list_items;
CREATE TRIGGER investor_list_items_funds_only
  BEFORE INSERT OR UPDATE OF investor_id ON public.investor_list_items
  FOR EACH ROW EXECUTE FUNCTION public.investor_list_items_check();

-- ─── Public read for the founder's link ─────────────────────────────────────
-- The founder has no account. This is the same pattern as the public form renderer: a SECURITY
-- DEFINER function keyed on the token, returning only what the founder should see.
--
-- Fund name and website ONLY, by explicit instruction. No ticket size, stage, sector focus or
-- internal notes — the founder is choosing who may be approached, not shopping.
CREATE OR REPLACE FUNCTION public.get_investor_list_public(p_token uuid)
RETURNS TABLE (
  list_id UUID, list_name TEXT, intro_note TEXT, status TEXT, responded_at TIMESTAMPTZ,
  deal_name TEXT,
  item_id UUID, investor_name TEXT, investor_website TEXT, approved BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id, l.name, l.intro_note, l.status::TEXT, l.responded_at,
    COALESCE(c.name, e.title, 'this deal'),
    i.id, inv.name, inv.website, i.approved
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

-- The founder's answer. One call writes every decision plus their own exclusions, so a partial
-- submission cannot leave half a list decided.
CREATE OR REPLACE FUNCTION public.submit_investor_list_response(
  p_token uuid,
  p_unapproved uuid[],
  p_exclusions jsonb DEFAULT '[]'::jsonb,
  p_note TEXT DEFAULT NULL
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
  -- replaces the previous answer rather than merging with it.
  UPDATE public.investor_list_items
     SET approved = true, decided_at = NOW()
   WHERE list_id = v_list.id;

  UPDATE public.investor_list_items
     SET approved = false, decided_at = NOW()
   WHERE list_id = v_list.id
     AND id = ANY(COALESCE(p_unapproved, '{}'));

  DELETE FROM public.investor_list_exclusions WHERE list_id = v_list.id AND matched_at IS NULL;
  INSERT INTO public.investor_list_exclusions (org_id, list_id, raw_name, reason)
  SELECT v_list.org_id, v_list.id,
         btrim(x->>'name'), NULLIF(btrim(COALESCE(x->>'reason', '')), '')
    FROM jsonb_array_elements(COALESCE(p_exclusions, '[]'::jsonb)) x
   WHERE length(btrim(COALESCE(x->>'name', ''))) > 0;

  UPDATE public.investor_lists
     SET responded_at = NOW(), founder_note = NULLIF(btrim(COALESCE(p_note, '')), '')
   WHERE id = v_list.id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.submit_investor_list_response(uuid, uuid[], jsonb, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_investor_list_response(uuid, uuid[], jsonb, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_investor_list_viewed(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.investor_lists
     SET first_viewed_at = COALESCE(first_viewed_at, NOW())
   WHERE share_token = p_token AND status = 'shared';
$$;

REVOKE ALL ON FUNCTION public.mark_investor_list_viewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_investor_list_viewed(uuid) TO anon, authenticated;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.investor_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_list_exclusions ENABLE ROW LEVEL SECURITY;

-- Internal staff only. Partners have no business seeing which funds a founder approved, and the
-- founder reaches theirs through the token function above, not through RLS.
DROP POLICY IF EXISTS "Investor lists internal" ON public.investor_lists;
CREATE POLICY "Investor lists internal" ON public.investor_lists
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id()
        AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );

DROP POLICY IF EXISTS "Investor list items internal" ON public.investor_list_items;
CREATE POLICY "Investor list items internal" ON public.investor_list_items
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id()
        AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );

DROP POLICY IF EXISTS "Investor list exclusions internal" ON public.investor_list_exclusions;
CREATE POLICY "Investor list exclusions internal" ON public.investor_list_exclusions
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id()
        AND public.get_user_role() IN ('founder', 'admin', 'associate'))
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate')
  );
