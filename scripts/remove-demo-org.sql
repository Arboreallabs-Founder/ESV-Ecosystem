-- Removes the AA Labs demo organisation: its accounts, everything it owns, and everything attached to
-- that. PERMANENT once run for real.
--
-- Run the whole file in the Supabase SQL editor. As it stands it is a DRY RUN: it carries out every
-- delete to prove it works, undoes all of it, and lists what would go. To do it for real, change the
-- `false` on the line marked below to `true`.
--
-- It stops, deleting nothing, if anything it would remove belongs to another organisation, if AA Labs has
-- an account that isn't a sample one, or if a real founder application is still there. Uploaded files are
-- not touched.

DROP TABLE IF EXISTS pg_temp.demo_rm;
DROP TABLE IF EXISTS pg_temp.demo_report;
CREATE TEMP TABLE demo_rm (tbl REGCLASS, pk TEXT, PRIMARY KEY (tbl, pk));
CREATE TEMP TABLE demo_report (kind TEXT, table_name TEXT, rows BIGINT, detail TEXT);

-- The primary key of row x of a table, as one piece of text.
CREATE OR REPLACE FUNCTION pg_temp.pk_of(p_tbl REGCLASS) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT 'concat_ws(''|'', ' || string_agg(format('x.%I::TEXT', a.attname), ', ' ORDER BY a.attnum) || ')'
    FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
   WHERE i.indrelid = p_tbl AND i.indisprimary;
$$;

CREATE OR REPLACE FUNCTION pg_temp.has_org(p_tbl REGCLASS) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = p_tbl AND attname = 'org_id' AND NOT attisdropped)
$$;

DO $$
DECLARE
  -- ┌───────────────────────────────────────────────────────────────┐
  v_for_real BOOLEAN := false;   -- ← change to true to delete for real
  -- └───────────────────────────────────────────────────────────────┘
  v_org    UUID;
  v_users  UUID[];
  v_before BIGINT;
  v_after  BIGINT;
  v_n      BIGINT;
  v_text   TEXT;
  v_left   INT;
  v_done   TEXT[] := '{}';
  v_tables REGCLASS[];
  f        RECORD;
  t        REGCLASS;
BEGIN
  -- ── Which organisation ──
  IF (SELECT count(*) FROM public.organizations WHERE name = 'AA Labs') <> 1 THEN
    INSERT INTO demo_report VALUES ('0 status', NULL, NULL, 'There is not exactly one organisation called AA Labs. Nothing was changed.');
    RETURN;
  END IF;
  SELECT id INTO v_org FROM public.organizations WHERE name = 'AA Labs';
  SELECT coalesce(array_agg(id), '{}') INTO v_users FROM public.users WHERE org_id = v_org;

  -- ── Reasons to stop ──
  INSERT INTO demo_report
  SELECT '1 STOP', 'users', 1, 'not a sample account: ' || email FROM public.users
   WHERE org_id = v_org AND email NOT ILIKE '%@aalabs.vc' AND email NOT ILIKE '%@aalabs-demo.com';
  INSERT INTO demo_report
  SELECT '1 STOP', 'form_links', 1, 'a live website link points here: ' || coalesce('/apply/' || fl.slug, '/apply')
    FROM public.form_links fl JOIN public.forms fm ON fm.id = fl.form_id WHERE fm.org_id = v_org AND fl.is_general;
  INSERT INTO demo_report
  SELECT '1 STOP', 'pipeline_entries', 1, 'real founder application still here: ' || coalesce(e.title, '') || ' <' || coalesce(e.submitter_email, '') || '>'
    FROM public.pipeline_entries e JOIN public.form_links fl ON fl.id = e.form_link_id JOIN public.forms fm ON fm.id = fl.form_id
   WHERE fm.org_id = v_org AND fl.label = 'General (website and company page)';

  -- ── Everything it owns ──
  INSERT INTO demo_rm VALUES ('public.organizations', v_org::TEXT);
  INSERT INTO demo_rm SELECT 'auth.users', unnest(v_users)::TEXT;
  FOR f IN
    SELECT c.oid::REGCLASS AS tbl FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relispartition
       AND pg_temp.has_org(c.oid::REGCLASS) AND pg_temp.pk_of(c.oid::REGCLASS) IS NOT NULL
  LOOP
    EXECUTE format('INSERT INTO demo_rm SELECT %L::REGCLASS, %s FROM %s x WHERE x.org_id = %L ON CONFLICT DO NOTHING',
                   f.tbl, pg_temp.pk_of(f.tbl), f.tbl, v_org);
  END LOOP;

  -- ── And everything that cannot exist without it, until nothing new turns up ──
  LOOP
    SELECT count(*) INTO v_before FROM demo_rm;
    FOR f IN
      SELECT con.conrelid::REGCLASS AS child, con.confrelid::REGCLASS AS parent, ca.attname AS ccol, pa.attname AS pcol
        FROM pg_constraint con
        JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
        JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
       WHERE con.contype = 'f' AND cardinality(con.conkey) = 1 AND con.connamespace = 'public'::regnamespace
         AND con.confdeltype IN ('c', 'a', 'r')
         AND con.confrelid::REGCLASS IN (SELECT DISTINCT tbl FROM demo_rm)
         AND pg_temp.pk_of(con.conrelid::REGCLASS) IS NOT NULL
    LOOP
      EXECUTE format(
        'INSERT INTO demo_rm SELECT %L::REGCLASS, %s FROM %s x
          WHERE x.%I IN (SELECT y.%I FROM (SELECT x.%I, %s AS k FROM %s x) y
                          JOIN demo_rm r ON r.tbl = %L::REGCLASS AND r.pk = y.k) ON CONFLICT DO NOTHING',
        f.child, pg_temp.pk_of(f.child), f.child, f.ccol, f.pcol, f.pcol, pg_temp.pk_of(f.parent), f.parent, f.parent);
    END LOOP;
    SELECT count(*) INTO v_after FROM demo_rm;
    EXIT WHEN v_after = v_before;
  END LOOP;
  SELECT array_agg(DISTINCT tbl) INTO v_tables FROM demo_rm;

  -- ── Does any of it belong to somebody else? ──
  FOREACH t IN ARRAY v_tables LOOP
    IF pg_temp.has_org(t) THEN
      EXECUTE format(
        'SELECT count(*), left(string_agg(coalesce(to_jsonb(x)->>''name'', to_jsonb(x)->>''title'', to_jsonb(x)->>''email'', to_jsonb(x)->>''id''), '', ''), 300)
           FROM %s x JOIN demo_rm r ON r.tbl = %L::REGCLASS AND r.pk = %s WHERE x.org_id IS DISTINCT FROM %L',
        t, t, pg_temp.pk_of(t), v_org) INTO v_n, v_text;
      IF v_n > 0 THEN
        INSERT INTO demo_report VALUES ('1 STOP', t::TEXT, v_n, 'another organisation''s rows, tied to AA Labs: ' || v_text);
      END IF;
    ELSIF t NOT IN ('public.organizations'::REGCLASS, 'auth.users'::REGCLASS) THEN
      -- No organisation of its own: it must not also be part of something that is staying.
      FOR f IN
        SELECT con.confrelid::REGCLASS AS parent, ca.attname AS ccol, pa.attname AS pcol
          FROM pg_constraint con
          JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
          JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
         WHERE con.contype = 'f' AND cardinality(con.conkey) = 1 AND con.conrelid = t
           AND con.confdeltype IN ('c', 'a', 'r') AND pg_temp.pk_of(con.confrelid::REGCLASS) IS NOT NULL
           AND (con.confdeltype = 'c' OR pg_temp.has_org(con.confrelid::REGCLASS))
      LOOP
        EXECUTE format(
          'SELECT count(*), left(string_agg(%s, '', ''), 300) FROM %s x JOIN demo_rm r ON r.tbl = %L::REGCLASS AND r.pk = %s
            WHERE x.%I IS NOT NULL AND x.%I NOT IN (
              SELECT y.%I FROM (SELECT x.%I, %s AS k FROM %s x) y JOIN demo_rm q ON q.tbl = %L::REGCLASS AND q.pk = y.k)',
          pg_temp.pk_of(t), t, t, pg_temp.pk_of(t), f.ccol, f.ccol, f.pcol, f.pcol, pg_temp.pk_of(f.parent), f.parent, f.parent)
          INTO v_n, v_text;
        IF v_n > 0 THEN
          INSERT INTO demo_report VALUES ('1 STOP', t::TEXT, v_n, format('also part of %s that stays (by %s): %s', f.parent, f.ccol, v_text));
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- ── What goes, and which links elsewhere are emptied ──
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format(
      'INSERT INTO demo_report SELECT ''2 delete'', %L, count(*),
         left(string_agg(coalesce(to_jsonb(x)->>''name'', to_jsonb(x)->>''title'', to_jsonb(x)->>''email'', ''''), '', ''), 400)
         FROM %s x JOIN demo_rm r ON r.tbl = %L::REGCLASS AND r.pk = %s', t::TEXT, t, t, pg_temp.pk_of(t));
  END LOOP;
  FOR f IN
    SELECT con.conrelid::REGCLASS AS child, con.confrelid::REGCLASS AS parent, ca.attname AS ccol, pa.attname AS pcol
      FROM pg_constraint con
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
     WHERE con.contype = 'f' AND cardinality(con.conkey) = 1 AND con.connamespace = 'public'::regnamespace
       AND con.confdeltype IN ('n', 'd') AND con.confrelid::REGCLASS = ANY (v_tables)
       AND pg_temp.pk_of(con.conrelid::REGCLASS) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s x WHERE x.%I IN (SELECT y.%I FROM (SELECT x.%I, %s AS k FROM %s x) y
          JOIN demo_rm r ON r.tbl = %L::REGCLASS AND r.pk = y.k)
         AND %s NOT IN (SELECT pk FROM demo_rm WHERE tbl = %L::REGCLASS)',
      f.child, f.ccol, f.pcol, f.pcol, pg_temp.pk_of(f.parent), f.parent, f.parent, pg_temp.pk_of(f.child), f.child) INTO v_n;
    IF v_n > 0 THEN
      INSERT INTO demo_report VALUES ('3 kept, link emptied', f.child::TEXT, v_n, f.ccol || ' pointed at ' || f.parent::TEXT);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM demo_report WHERE kind = '1 STOP') THEN
    INSERT INTO demo_report VALUES ('0 status', NULL, NULL, 'STOPPED. Nothing was changed. See the STOP rows.');
    RETURN;
  END IF;

  -- ── Delete, in whatever order the links allow; all of it or none ──
  BEGIN
    LOOP
      v_left := 0;
      v_n := 0;
      FOREACH t IN ARRAY v_tables LOOP
        CONTINUE WHEN t::TEXT = ANY (v_done) OR t = 'auth.users'::REGCLASS
          OR (t = 'public.organizations'::REGCLASS AND cardinality(v_done) < cardinality(array_remove(v_tables, 'auth.users'::REGCLASS)) - 1);
        BEGIN
          EXECUTE format('DELETE FROM %s x USING demo_rm r WHERE r.tbl = %L::REGCLASS AND r.pk = %s', t, t, pg_temp.pk_of(t));
          -- Anything written while deleting, such as the activity log.
          IF pg_temp.has_org(t) THEN EXECUTE format('DELETE FROM %s WHERE org_id = %L', t, v_org); END IF;
          v_done := array_append(v_done, t::TEXT);
          v_n := v_n + 1;
        EXCEPTION WHEN foreign_key_violation THEN
          v_left := v_left + 1;
          v_text := t::TEXT || ': ' || SQLERRM;
        END;
      END LOOP;
      EXIT WHEN v_left = 0 AND 'organizations' = ANY (v_done);
      IF v_n = 0 THEN RAISE EXCEPTION 'Could not delete everything, so nothing was. Stuck at %', v_text; END IF;
    END LOOP;
    DELETE FROM auth.users WHERE id = ANY (v_users);
    IF to_regclass('public.activity_events') IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.activity_events WHERE org_id = %L', v_org);
    END IF;

    IF NOT v_for_real THEN RAISE EXCEPTION 'dry run' USING ERRCODE = 'P0DRY'; END IF;
    INSERT INTO demo_report VALUES ('0 status', NULL, NULL, 'DONE. AA Labs has been removed.');
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      INSERT INTO demo_report VALUES ('0 status', NULL, NULL, 'DRY RUN. It would work. Nothing was changed.');
    WHEN OTHERS THEN
      INSERT INTO demo_report VALUES ('0 status', NULL, NULL, 'FAILED. Nothing was changed. ' || SQLERRM);
  END;
END $$;

SELECT * FROM demo_report ORDER BY kind, table_name;
