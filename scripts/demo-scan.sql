-- Finds demo data: every row tagged "[DEMO]" (or described as seeded demo data) in any table, the rows
-- attached to those, and the companies, investors and partners they point at. Changes nothing: it only
-- makes a temporary list, gone when the session ends. Run the whole file in the Supabase SQL editor.

DROP TABLE IF EXISTS pg_temp.demo_found;
CREATE TEMP TABLE demo_found (lvl INT, tbl TEXT, row_id TEXT, how TEXT, label TEXT);

DO $$
DECLARE
  c RECORD;
  n INT;
BEGIN
  -- Tagged rows.
  FOR c IN
    SELECT col.table_name, col.column_name
      FROM information_schema.columns col
      JOIN information_schema.tables t ON t.table_schema = col.table_schema AND t.table_name = col.table_name
     WHERE col.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND col.data_type IN ('text', 'character varying')
       AND col.table_name NOT IN ('activity_events', 'app_error_log', 'notifications')
  LOOP
    EXECUTE format(
      'INSERT INTO demo_found SELECT 0, %L, coalesce(to_jsonb(x)->>''id'', ''(no id)''), ''tagged in %s'', left(x.%I, 80)
         FROM public.%I x
        WHERE (x.%I ILIKE %L OR x.%I ILIKE %L)
          AND NOT EXISTS (SELECT 1 FROM demo_found f WHERE f.tbl = %L AND f.row_id = to_jsonb(x)->>''id'')',
      c.table_name, c.column_name, c.column_name, c.table_name,
      c.column_name, '%[demo]%', c.column_name, '%seeded demo%', c.table_name);
  END LOOP;

  -- Logins that look like demo ones, and the partner each belongs to. (ssgp@ is listed to be asked about.)
  INSERT INTO demo_found
  SELECT 0, 'users', u.id::TEXT, 'demo-looking login (' || u.role || ')', u.name || ' <' || u.email || '>'
    FROM public.users u
   WHERE u.email ILIKE ANY (ARRAY['partnerdemo@%', 'demohr@%', 'ssgp@%']);
  INSERT INTO demo_found
  SELECT DISTINCT 0, 'franchise_partners', fp.id::TEXT, 'partner behind ' || u.email, left(fp.name, 80)
    FROM public.users u JOIN public.franchise_partners fp ON fp.id = u.franchise_partner_id
   WHERE u.email ILIKE ANY (ARRAY['partnerdemo@%', 'demohr@%', 'ssgp@%'])
     AND NOT EXISTS (SELECT 1 FROM demo_found f WHERE f.tbl = 'franchise_partners' AND f.row_id = fp.id::TEXT);

  -- Rows attached to them, up to three steps away.
  FOR n IN 0..2 LOOP
    FOR c IN
      SELECT child.relname AS child, att.attname AS col, parent.relname AS parent,
             CASE con.confdeltype WHEN 'c' THEN 'deleted with it' WHEN 'n' THEN 'kept, link cleared' ELSE 'blocks deleting it' END AS rule
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_class parent ON parent.oid = con.confrelid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
       WHERE con.contype = 'f' AND cardinality(con.conkey) = 1
         AND con.connamespace = 'public'::regnamespace AND parent.relnamespace = 'public'::regnamespace
         AND child.relname NOT IN ('activity_events', 'app_error_log', 'notifications')
         AND parent.relname NOT IN ('organizations', 'users')
         AND parent.relname IN (SELECT tbl FROM demo_found WHERE lvl = n)
    LOOP
      EXECUTE format(
        'INSERT INTO demo_found SELECT %s, %L, coalesce(to_jsonb(x)->>''id'', ''(no id)''), %L,
                left(coalesce(to_jsonb(x)->>''name'', to_jsonb(x)->>''title'', to_jsonb(x)->>''label'', ''''), 80)
           FROM public.%I x
          WHERE x.%I::TEXT IN (SELECT row_id FROM demo_found WHERE lvl = %s AND tbl = %L)
            AND NOT EXISTS (SELECT 1 FROM demo_found f WHERE f.tbl = %L AND f.row_id = to_jsonb(x)->>''id'')',
        n + 1, c.child, format('attached to %s by %s (%s)', c.parent, c.col, c.rule),
        c.child, c.col, n, c.parent, c.child);
    END LOOP;
  END LOOP;

  -- What they point at. These may well be real: listed to be looked at, not to be deleted.
  FOR c IN
    SELECT child.relname AS child, att.attname AS col, parent.relname AS parent
      FROM pg_constraint con
      JOIN pg_class child ON child.oid = con.conrelid
      JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND cardinality(con.conkey) = 1 AND con.connamespace = 'public'::regnamespace
       AND parent.relnamespace = 'public'::regnamespace
       AND parent.relname IN ('companies', 'investors', 'franchise_partners')
       AND child.relname IN (SELECT tbl FROM demo_found)
  LOOP
    EXECUTE format(
      'INSERT INTO demo_found SELECT DISTINCT 9, %L, p.id::TEXT, %L, left(coalesce(to_jsonb(p)->>''name'', ''''), 80)
         FROM public.%I x JOIN public.%I p ON p.id = x.%I
        WHERE to_jsonb(x)->>''id'' IN (SELECT row_id FROM demo_found WHERE tbl = %L)
          AND NOT EXISTS (SELECT 1 FROM demo_found f WHERE f.tbl = %L AND f.row_id = p.id::TEXT)',
      c.parent, format('pointed at by %s, MAY BE REAL', c.child),
      c.child, c.parent, c.col, c.child, c.parent);
  END LOOP;
END $$;

SELECT CASE lvl WHEN 0 THEN '1 demo' WHEN 9 THEN '3 may be real' ELSE '2 attached' END AS kind,
       tbl AS table_name, how, label, count(*) AS rows, string_agg(row_id, ', ' ORDER BY row_id) AS ids
  FROM demo_found
 GROUP BY 1, tbl, how, label
 ORDER BY 1, tbl, how, label;
