/**
 * Backfill investor notes from funds.json.
 *
 *   node scripts/import-funds/backfill-notes.mjs            # dry run
 *   node scripts/import-funds/backfill-notes.mjs --commit
 *
 * The notes were collated on the first pass but never written — there was no column for them. This
 * fills the gap without re-running the whole import. Requires migration 20260903000000.
 *
 * Only writes where the fund currently has no notes, so anything typed in the app since the import
 * is left alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const COMMIT = process.argv.includes('--commit')

const env = Object.fromEntries(
  fs.readFileSync('C:/dev/ESV-Ecosystem/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const funds = JSON.parse(fs.readFileSync(path.join(DIR, 'funds.json'), 'utf8'))
const res = await fetch(`${URL_}/rest/v1/investors?select=id,name,notes&import_source=not.is.null`, { headers: H })
const existing = await res.json()
if (!Array.isArray(existing)) {
  console.error('Read failed — has migration 20260903000000 been run?', JSON.stringify(existing).slice(0, 200))
  process.exit(1)
}
const byName = new Map(existing.map((i) => [norm(i.name), i]))

const plan = []
for (const f of funds) {
  if (!f.notes?.length) continue
  const row = byName.get(norm(f.name))
  if (!row) continue
  if (row.notes) continue          // already has notes; do not clobber
  plan.push({ id: row.id, name: f.name, notes: f.notes.join('\n\n') })
}

const chars = plan.reduce((n, p) => n + p.notes.length, 0)
console.log(`${plan.length} funds would gain notes (${chars.toLocaleString()} characters)`)
console.log(`skipped: ${funds.filter((f) => f.notes?.length).length - plan.length} (no match, or already has notes)`)
console.log('\nsample:')
for (const p of plan.slice(0, 5)) console.log(`  ${p.name}: ${p.notes.slice(0, 90).replace(/\n/g, ' ')}…`)

if (!COMMIT) {
  console.log('\nDry run. Re-run with --commit to write.')
  process.exit(0)
}

let done = 0
for (const p of plan) {
  const r = await fetch(`${URL_}/rest/v1/investors?id=eq.${p.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ notes: p.notes }),
  })
  if (!r.ok) { console.error(`FAILED ${p.name}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
  done++
  if (done % 50 === 0) console.log(`  …${done}`)
}
console.log(`\nwrote notes to ${done} funds`)
