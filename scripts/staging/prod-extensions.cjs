// Read-only: print production's installed extensions as CREATE EXTENSION statements, for staging.
// A schema-only dump of `public` doesn't include extensions, but its indexes and functions use them.
//   node prod-extensions.cjs <prod db url> > extensions.sql
const { Client } = require('pg')
const url = process.argv[2]
;(async () => {
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query('BEGIN READ ONLY')
  const r = await db.query(`select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                            where e.extname <> 'plpgsql' order by e.extname`)
  for (const { extname, nspname } of r.rows) {
    console.log(`CREATE EXTENSION IF NOT EXISTS "${extname}" WITH SCHEMA "${nspname}";`)
  }
  await db.query('ROLLBACK')
  await db.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
