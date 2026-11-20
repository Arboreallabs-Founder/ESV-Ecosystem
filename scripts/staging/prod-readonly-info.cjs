// Read-only look at PRODUCTION: which migrations it has applied, and the newest one.
// Runs in a READ ONLY transaction so nothing here can write, whatever the query.
//   node prod-readonly-info.cjs <prod db url>
const { Client } = require('pg')
const url = process.argv[2]
if (!url) throw new Error('usage: node prod-readonly-info.cjs <prod db url>')

;(async () => {
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query('BEGIN READ ONLY')
  const hasTable = await db.query("select to_regclass('supabase_migrations.schema_migrations') is not null as ok")
  if (hasTable.rows[0].ok) {
    const r = await db.query('select version from supabase_migrations.schema_migrations order by version')
    const versions = r.rows.map((x) => x.version)
    console.log(JSON.stringify({ count: versions.length, newest: versions[versions.length - 1], tail: versions.slice(-8) }))
  } else {
    console.log(JSON.stringify({ count: 0, note: 'no migration history table' }))
  }
  const t = await db.query("select count(*)::int as n from pg_tables where schemaname='public'")
  console.log(JSON.stringify({ public_tables: t.rows[0].n }))
  const objs = await db.query(`select
      (select count(*) from pg_tables where schemaname='public' and tablename in ('activity_events')) as activity_events,
      (select count(*) from information_schema.columns where table_schema='public' and table_name='company_field_defs' and column_name='config') as field_config`)
  console.log(JSON.stringify({ new_objects_already_in_prod: objs.rows[0] }))
  await db.query('ROLLBACK')
  await db.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
