-- Merging duplicate investor records, from inside the app.
--
-- The database holds two rows for one fund in at least eighteen cases — "RPSG Capital" and "RPSG
-- Capital Ventures", "Blume" and "Blume Ventures", "Artha Ventures" and "Artha Venture Fund", plus
-- a dozen angels imported twice under identical names.
--
-- The visible symptom is on investor lists: a fund appears twice in the suggestions, sometimes once
-- as a thematic match and once as sector-agnostic. That is not a bug in the banding — a record
-- lands in exactly one band — it is two records each qualifying honestly on their own tags. There
-- is nothing to fix in the suggestion logic; the duplicates are the fault.
--
-- ─── Why the references are discovered rather than listed ───────────────────
-- A dozen tables point at investors.id, and the number grows. Writing that list out by hand means
-- the merge silently stops being complete the next time somebody adds a table — and the failure
-- mode is not an error, it is a row still pointing at a record that no longer exists, or worse, a
-- deleted row taking its children with it via ON DELETE CASCADE.
--
-- So the function reads pg_constraint at run time and repoints every foreign key it finds. It
-- cannot be out of date, because there is no list to update.

CREATE OR REPLACE FUNCTION public.merge_investors(p_keep UUID, p_merge UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep     public.investors%ROWTYPE;
  v_merge    public.investors%ROWTYPE;
  v_role     TEXT;
  r          RECORD;
  v_moved    JSONB := '{}'::JSONB;
  v_count    INT;
  v_dropped  INT;
BEGIN
  -- Founder/admin only. Merging is destructive and unpicking it afterwards means restoring from a
  -- backup, so it sits with the roles that already carry irreversible calls.
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid();
  IF coalesce(v_role, '') NOT IN ('founder', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only a founder or admin can merge investor records.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_keep = p_merge THEN
    RAISE EXCEPTION 'Those are the same record.';
  END IF;

  SELECT * INTO v_keep  FROM public.investors WHERE id = p_keep;
  IF NOT FOUND THEN RAISE EXCEPTION 'The record to keep no longer exists.'; END IF;
  SELECT * INTO v_merge FROM public.investors WHERE id = p_merge;
  IF NOT FOUND THEN RAISE EXCEPTION 'The record to merge no longer exists.'; END IF;

  -- Both in the caller's own organisation. Same-org-as-each-other is not enough: this is
  -- SECURITY DEFINER, so without the second half a founder of one tenant who knew two ids could
  -- merge another tenant's records. That is the shape of hole the August audit found in five other
  -- functions, and it is cheaper to not write it again than to find it later.
  IF v_keep.org_id IS DISTINCT FROM v_merge.org_id
     OR v_keep.org_id IS DISTINCT FROM public.get_user_org_id() THEN
    RAISE EXCEPTION 'Those records are not both in your organisation.';
  END IF;

  -- ─── Repoint every reference ──────────────────────────────────────────────
  FOR r IN
    SELECT c.conrelid::regclass::TEXT AS tbl,
           a.attname::TEXT            AS col
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.investors'::regclass
       -- Single-column keys only. A composite key into investors would need its other columns
       -- considered too, and there are none today; if one ever appears this raises rather than
       -- half-doing it.
       AND array_length(c.conkey, 1) = 1
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
        USING p_keep, p_merge;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_dropped := 0;
    EXCEPTION WHEN unique_violation THEN
      -- The keeper already has this relationship — the duplicate is on a list, a deal or a POC
      -- mapping the keeper is on too. Repointing would collide with a row that already says the
      -- same thing, so the loser's copy is redundant and goes. Nothing is lost that the keeper
      -- does not already have.
      EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING p_merge;
      GET DIAGNOSTICS v_dropped = ROW_COUNT;
      v_count := 0;
    END;

    IF v_count > 0 OR v_dropped > 0 THEN
      v_moved := v_moved || jsonb_build_object(
        r.tbl || '.' || r.col,
        jsonb_build_object('moved', v_count, 'dropped_as_duplicate', v_dropped)
      );
    END IF;
  END LOOP;

  -- ─── Take anything the keeper was missing ─────────────────────────────────
  -- The keeper's own values win. This only fills gaps, because the admin chose which record is
  -- right and a merge that overwrote their choice would be an argument with them.
  UPDATE public.investors k SET
    website          = COALESCE(k.website, v_merge.website),
    country          = COALESCE(k.country, v_merge.country),
    stage            = COALESCE(k.stage, v_merge.stage),
    logo_url         = COALESCE(k.logo_url, v_merge.logo_url),
    ticket_size_min  = COALESCE(k.ticket_size_min, v_merge.ticket_size_min),
    ticket_size_max  = COALESCE(k.ticket_size_max, v_merge.ticket_size_max),
    ticket_currency  = COALESCE(k.ticket_currency, v_merge.ticket_currency),
    esv_poc_id       = COALESCE(k.esv_poc_id, v_merge.esv_poc_id),
    connect_strength = COALESCE(k.connect_strength, v_merge.connect_strength),
    birthday_md      = COALESCE(k.birthday_md, v_merge.birthday_md),
    birthday_year    = COALESCE(k.birthday_year, v_merge.birthday_year),
    -- Unioned, not replaced: two records describing one fund each know part of what it invests in,
    -- and that is exactly the split that put the same fund in two bands on a suggestion list.
    sectors          = ARRAY(SELECT DISTINCT unnest(COALESCE(k.sectors, '{}') || COALESCE(v_merge.sectors, '{}'))),
    excluded_sectors = ARRAY(SELECT DISTINCT unnest(COALESCE(k.excluded_sectors, '{}') || COALESCE(v_merge.excluded_sectors, '{}'))),
    business_types   = ARRAY(SELECT DISTINCT unnest(COALESCE(k.business_types, '{}') || COALESCE(v_merge.business_types, '{}'))),
    meta_tags        = ARRAY(SELECT DISTINCT unnest(COALESCE(k.meta_tags, '{}') || COALESCE(v_merge.meta_tags, '{}'))),
    esv_poc_names    = ARRAY(SELECT DISTINCT unnest(COALESCE(k.esv_poc_names, '{}') || COALESCE(v_merge.esv_poc_names, '{}'))),
    -- Kept whole rather than picked between. Notes are somebody's sentences about the fund, and
    -- silently dropping half of what we know is worse than a slightly long field.
    notes            = CASE
                         WHEN COALESCE(btrim(v_merge.notes), '') = '' THEN k.notes
                         WHEN COALESCE(btrim(k.notes), '') = ''       THEN v_merge.notes
                         WHEN k.notes = v_merge.notes                 THEN k.notes
                         ELSE k.notes || E'\n\n--- merged from "' || v_merge.name || '" ---\n' || v_merge.notes
                       END
  WHERE k.id = p_keep;

  -- ─── The record goes, the fact that it existed does not ───────────────────
  -- Written before the delete: investor_edit_log.investor_id is ON DELETE SET NULL, so a row
  -- written after would lose the link, and one written for the loser would be nulled anyway. This
  -- is logged against the survivor, which is where anybody looking for it will be.
  INSERT INTO public.investor_edit_log (investor_id, org_id, edited_by, edited_by_name, investor_name, changes)
  SELECT p_keep, v_keep.org_id, auth.uid(), u.name, v_keep.name,
         format('Merged in "%s" (%s). References moved: %s',
                v_merge.name, p_merge, COALESCE(v_moved::TEXT, '{}'))
    FROM public.users u WHERE u.id = auth.uid();

  DELETE FROM public.investors WHERE id = p_merge;

  RETURN jsonb_build_object(
    'kept', v_keep.name,
    'merged', v_merge.name,
    'references', v_moved
  );
END $$;

REVOKE ALL ON FUNCTION public.merge_investors(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_investors(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_investors(UUID, UUID) TO authenticated;

-- ─── Finding them ───────────────────────────────────────────────────────────
-- Normalised name matching, done in the database because it has to run over every investor and
-- shipping 432 rows to the browser to compare them is the wrong place for it.
--
-- Stripping the fund suffixes is what makes it useful: "Blume" and "Blume Ventures" share no exact
-- name, and those are precisely the pairs a person scrolling the list does not notice.
CREATE OR REPLACE FUNCTION public.find_investor_duplicates()
RETURNS TABLE (
  match_key TEXT,
  ids UUID[],
  names TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normed AS (
    SELECT i.id, i.name,
           btrim(regexp_replace(
             regexp_replace(
               regexp_replace(lower(i.name), '[^a-z0-9 ]', '', 'g'),
               '\y(capital|ventures|venture|partners|partner|fund|funds|llp|lp|pvt|ltd|limited|advisors|advisers|management|group|holdings|india)\y',
               '', 'g'),
             '\s+', ' ', 'g')) AS key
      FROM public.investors i
     WHERE i.org_id = public.get_user_org_id()
  )
  SELECT n.key, array_agg(n.id ORDER BY n.name), array_agg(n.name ORDER BY n.name)
    FROM normed n
   WHERE n.key <> ''
   GROUP BY n.key
  HAVING count(*) > 1
   ORDER BY n.key;
$$;

REVOKE ALL ON FUNCTION public.find_investor_duplicates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_investor_duplicates() FROM anon;
GRANT EXECUTE ON FUNCTION public.find_investor_duplicates() TO authenticated;
