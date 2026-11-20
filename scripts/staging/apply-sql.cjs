// STAGING ONLY: run SQL files against the staging database, in order. Used by rebuild.ps1.
//   node apply-sql.cjs <staging db url> <file.sql> [more.sql ...]
// Each file gets its own connection: a pg_dump empties search_path for its session, which would
// otherwise leak into the migrations applied after it. Lines psql would treat as meta-commands
// (pg_dump 17 emits "\restrict ...") are dropped. Refuses the production project.
const fs = require('fs')
const { Client } = require('pg')
const [url, ...files] = process.argv.slice(2)
if (!url || files.length === 0) throw new Error('usage: node apply-sql.cjs <staging db url> <file.sql> ...')
if (url.includes('hsabrzwsetjeaqutjrjb')) throw new Error('Refusing: that is the PRODUCTION project.')

function prepare(file) {
  // Strip a byte-order mark: Windows tools (PowerShell's Tee-Object/Out-File) add one.
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
    .filter((l) => !l.startsWith('\\'))
    // Defaults for Supabase's internal admin role can't be set by the postgres login, and staging
    // already has Supabase's defaults (reset-public.cjs).
    .filter((l) => !/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin\b/.test(l))
    // A pg_dump of public recreates the schema; reset-public.cjs already did (with Supabase's grants).
    .map((l) => (l === 'CREATE SCHEMA public;' ? 'CREATE SCHEMA IF NOT EXISTS public;' : l))
    .join('\n')
}

;(async () => {
  for (const file of files) {
    const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await db.connect()
    try {
      await db.query(prepare(file))
      console.log(`applied ${file}`)
    } catch (e) {
      console.error(`FAILED ${file}: ${e.message}${e.position ? ` (at char ${e.position})` : ''}`)
      process.exitCode = 1
      return
    } finally {
      await db.end()
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1) })
