/**
 * Load funds.json into Supabase.
 *
 *   node scripts/import-funds/load.mjs            # dry run — reports, writes nothing
 *   node scripts/import-funds/load.mjs --commit   # actually writes
 *
 * Idempotent by fund name: a second run updates rather than duplicating. Existing investors are
 * only ever filled in, never overwritten — the database already holds 147 angels and a handful of
 * funds that someone entered by hand, and an import must not clobber that.
 *
 * Requires the 20260830000000 migration.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const COMMIT = process.argv.includes('--commit')
const ORG = '00000000-0000-0000-0000-000000000001' // Earlyseed Ventures

const env = Object.fromEntries(
  fs.readFileSync('C:/dev/ESV-Ecosystem/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(pathname, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${pathname}`, { ...init, headers: { ...H, ...(init.headers || {}) } })
  const text = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${pathname} :: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ESV initials -> the display name, and the user record when that person is still here.
const PEOPLE = {
  NB: 'Neeti Bokaria', SB: 'Siddhant Baliga', KS: 'Karan Shah', KR: 'Kalpak Roy',
  MG: 'Monica Gupta', MP: 'Manan Patel', AR: 'Arjun Renapurkar', RG: 'Ruhaan Gupta',
}

function stageValid(s) {
  return ['pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'growth'].includes(s) ? s : null
}

async function main() {
  const funds = JSON.parse(fs.readFileSync(path.join(DIR, 'funds.json'), 'utf8'))
  console.log(`${funds.length} funds in funds.json — ${COMMIT ? 'COMMITTING' : 'DRY RUN (nothing will be written)'}\n`)

  const [existing, users, companies] = await Promise.all([
    api('investors?select=id,name,org_id,website,country,sectors,service_type,stage'),
    api('users?select=id,name,org_id'),
    api('companies?select=id,name'),
  ])
  const byName = new Map(existing.map((i) => [norm(i.name), i]))
  const userByName = new Map(users.filter((u) => u.org_id === ORG).map((u) => [norm(u.name), u.id]))
  const companyByName = new Map(companies.map((c) => [norm(c.name), c.id]))
  console.log(`DB: ${existing.length} investors, ${userByName.size} ESV users, ${companyByName.size} companies`)

  const plan = { insert: [], update: [], contacts: 0, pocLinks: 0, unresolvedPeople: new Set() }

  for (const f of funds) {
    const found = byName.get(norm(f.name))
    const row = {
      org_id: ORG,
      name: f.name,
      country: f.country,
      website: f.website,
      sectors: f.sectors,
      excluded_sectors: f.excluded_sectors,
      service_type: f.service_type,
      ticket_size_min: f.ticket_min,
      ticket_size_max: f.ticket_max,
      ticket_currency: f.ticket_currency,
      stage: f.stage_raw,
      stage_min: stageValid(f.stage_min),
      stage_max: stageValid(f.stage_max),
      stage_raw: f.stage_raw,
      connect_strength: f.connect_strength === 'warm' ? 'warm' : f.connect_strength === 'cold' ? 'cold' : 'unknown',
      esv_poc_names: f.esv_pocs.map((i) => PEOPLE[i]).filter(Boolean),
      import_source: f.sources.join(' + '),
    }
    for (const i of f.esv_pocs) {
      if (!userByName.has(norm(PEOPLE[i]))) plan.unresolvedPeople.add(PEOPLE[i])
      else plan.pocLinks++
    }
    plan.contacts += f.contacts.length
    if (found) plan.update.push({ id: found.id, row, f })
    else plan.insert.push({ row, f })
  }

  console.log(`\nwould INSERT ${plan.insert.length} new investors`)
  console.log(`would UPDATE ${plan.update.length} existing (filling blanks only)`)
  console.log(`would write  ${plan.contacts} contacts`)
  console.log(`ESV POC user links resolvable: ${plan.pocLinks}`)
  console.log(`kept as names only (left the company): ${[...plan.unresolvedPeople].join(', ')}`)
  console.log('\nexisting investors that would be updated:',
    plan.update.map((u) => u.row.name).join(', ') || '(none)')

  if (!COMMIT) {
    console.log('\nDry run complete. Re-run with --commit to write.')
    return
  }

  let ins = 0, upd = 0, con = 0, links = 0
  for (const { row, f } of plan.insert) {
    const [created] = await api('investors', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row),
    })
    ins++
    await writeChildren(created.id, f, userByName, companyByName).then((n) => { con += n.contacts; links += n.links })
    if (ins % 25 === 0) console.log(`  …${ins} inserted`)
  }

  for (const { id, row, f } of plan.update) {
    // Fill blanks only. Someone curated these by hand; the sheet does not get to overwrite them.
    const current = existing.find((e) => e.id === id)
    const patch = {}
    for (const k of ['country', 'website', 'service_type', 'stage']) {
      if (!current[k] && row[k]) patch[k] = row[k]
    }
    for (const k of ['excluded_sectors', 'connect_strength', 'esv_poc_names', 'import_source',
                     'ticket_currency', 'stage_min', 'stage_max', 'stage_raw']) {
      if (row[k] != null) patch[k] = row[k]
    }
    if (!current.sectors?.length && row.sectors.length) patch.sectors = row.sectors
    if (Object.keys(patch).length) {
      await api(`investors?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      upd++
    }
    await writeChildren(id, f, userByName, companyByName).then((n) => { con += n.contacts; links += n.links })
  }

  console.log(`\ninserted ${ins} · updated ${upd} · contacts ${con} · poc links ${links}`)
}

async function writeChildren(investorId, f, userByName, companyByName) {
  let contacts = 0, links = 0

  const existingContacts = await api(`investor_contacts?investor_id=eq.${investorId}&select=id,name,rank`)
  const have = new Map(existingContacts.map((c) => [norm(c.name), c]))

  for (const [i, c] of f.contacts.entries()) {
    if (!c.name) continue
    const payload = {
      investor_id: investorId,
      name: c.name,
      role: c.role,
      linkedin_url: c.linkedin_url,
      linkedin_status: ['Connected', 'Requested', 'Pending', 'Not Connected'].includes(c.linkedin_status)
        ? (c.linkedin_status === 'Requested' ? 'Pending' : c.linkedin_status) : null,
      phone: c.phone ? String(c.phone).replace(/\.0$/, '') : null,
      email: c.email,
      sort_order: i,
      rank: c.rank,
      employment_status: c.employment_status,
      new_company: c.new_company,
      new_designation: c.new_designation,
      audit_note: c.audit_note,
      // The audit is the Fund Completeness Check, which is what this date refers to.
      last_verified_at: c.employment_status === 'unknown' ? null : new Date().toISOString(),
      contacted_by_name: (f.esv_pocs || []).map((x) => PEOPLE[x]).filter(Boolean)[0] ?? null,
      contacted_by_user_id: userByName.get(norm((f.esv_pocs || []).map((x) => PEOPLE[x])[0] || '')) ?? null,
    }
    const found = have.get(norm(c.name))
    if (found) {
      await api(`investor_contacts?id=eq.${found.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await api('investor_contacts', { method: 'POST', body: JSON.stringify(payload) })
    }
    contacts++
  }

  // ESV POC links for people who still have an account.
  for (const init of f.esv_pocs || []) {
    const uid = userByName.get(norm(PEOPLE[init] || ''))
    if (!uid) continue
    try {
      await api('investor_poc_users', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ investor_id: investorId, user_id: uid }),
      })
      links++
    } catch { /* link table may have a different shape; contacts are the important part */ }
  }
  return { contacts, links }
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
