/**
 * Import fund portfolios from the Tracxn research CSV.
 *
 *   node scripts/import-funds/import-portfolio.mjs <file.csv>            # dry run
 *   node scripts/import-funds/import-portfolio.mjs <file.csv> --commit
 *
 * Every tag is validated against the vocabulary already in the database before anything is
 * written. A tag that does not match is REPORTED, not stored: "Fintech" alongside "FinTech" splits
 * every rollup in two and nothing tells you it happened. That is the whole reason the research
 * prompt specified a controlled list.
 *
 * Requires migration 20260830000000 (investor_portfolio).
 */
import fs from 'node:fs'

const FILE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
if (!FILE) { console.error('Usage: import-portfolio.mjs <file.csv> [--commit]'); process.exit(1) }

const env = Object.fromEntries(
  fs.readFileSync('C:/dev/ESV-Ecosystem/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const ORG = '00000000-0000-0000-0000-000000000001'

const api = async (p, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${p} :: ${t.slice(0, 240)}`)
  return t ? JSON.parse(t) : null
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const STAGES = ['pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'growth']

/** Levenshtein, bounded — only used to spot typo-duplicates in a list of at most a few hundred. */
function editDistance(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) m[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return m[a.length][b.length]
}

/** Minimal CSV reader — handles quoted fields, which Tracxn company names contain. */
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const header = rows.shift().map((h) => h.trim())
  return rows.filter((r) => r.some((c) => c.trim())).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const rows = parseCsv(fs.readFileSync(FILE, 'utf8'))
console.log(`${rows.length} rows in ${FILE}\n`)

// The vocabulary in use, straight from the database — not a copy that can drift from it.
const investors = await api('investors?select=id,name,sectors,business_types,service_type')
const companies = await api('companies?select=id,name')
const VOCAB = new Set(investors.flatMap((i) => i.sectors ?? []).map(norm))
const BTYPES = new Set(investors.flatMap((i) => i.business_types ?? []).map(norm))
const canonical = new Map(investors.flatMap((i) => i.sectors ?? []).map((s) => [norm(s), s]))
const canonicalBt = new Map(investors.flatMap((i) => i.business_types ?? []).map((s) => [norm(s), s]))
const byName = new Map(investors.map((i) => [norm(i.name), i]))
const companyByName = new Map(companies.map((c) => [norm(c.name), c.id]))

const plan = []
const problems = { fund: new Set(), sector: new Map(), btype: new Map(), stage: new Set(), dupes: [] }
const seen = new Map()

for (const r of rows) {
  const inv = byName.get(norm(r.fund_name))
  if (!inv) { problems.fund.add(r.fund_name); continue }

  const split = (v) => (v || '').split(';').map((x) => x.trim()).filter(Boolean)

  const sectors = []
  for (const t of split(r.sector_tags)) {
    if (VOCAB.has(norm(t))) sectors.push(canonical.get(norm(t)))
    else problems.sector.set(t, (problems.sector.get(t) ?? 0) + 1)
  }
  const btypes = []
  for (const t of split(r.business_type_tags)) {
    if (BTYPES.has(norm(t))) btypes.push(canonicalBt.get(norm(t)))
    else problems.btype.set(t, (problems.btype.get(t) ?? 0) + 1)
  }

  let stage = r.invested_stage || null
  if (stage && !STAGES.includes(stage)) { problems.stage.add(stage); stage = null }
  const year = /^\d{4}$/.test(r.invested_year) ? Number(r.invested_year) : null

  // Near-duplicate names within one fund — "Elixiir Foods" and "Elixir Foods" are almost certainly
  // the same company entered twice, and merging them silently would be worse than saying so.
  const key = `${inv.id}::${norm(r.company_name)}`
  if (seen.has(key)) { problems.dupes.push(`${r.fund_name}: ${r.company_name} (exact repeat)`); continue }
  for (const [k, name] of seen) {
    if (!k.startsWith(inv.id)) continue
    const a = k.split('::')[1], b = norm(r.company_name)
    if (a === b) continue
    // Substring alone misses a single-letter difference — "elixiirfoods" does not contain
    // "elixirfoods" — which is exactly the case this data has. Edit distance catches typos;
    // substring still catches "Blue Tokai" vs "Blue Tokai Coffee Roasters".
    if (a.includes(b) || b.includes(a) || (Math.min(a.length, b.length) >= 6 && editDistance(a, b) <= 2)) {
      problems.dupes.push(`${r.fund_name}: "${name}" vs "${r.company_name}" — near-identical, both kept`)
    }
  }
  seen.set(key, r.company_name)

  plan.push({
    org_id: ORG,
    investor_id: inv.id,
    company_name: r.company_name,
    company_id: companyByName.get(norm(r.company_name)) ?? null,
    sector_tags: sectors,
    business_type_tags: btypes,
    invested_stage: stage,
    invested_year: year,
    notes: r.source_url ? `Tracxn: ${r.source_url}${r.confidence ? ` (${r.confidence} confidence)` : ''}` : null,
    _fund: r.fund_name,
  })
}

const perFund = plan.reduce((a, p) => (a[p._fund] = (a[p._fund] ?? 0) + 1, a), {})
console.log('would import:')
for (const [f, n] of Object.entries(perFund)) console.log(`  ${String(n).padStart(3)}  ${f}`)
console.log(`  ${plan.length} total · ${plan.filter((p) => p.company_id).length} linked to a company we already track`)

if (problems.fund.size) {
  console.log(`\nFUND NOT FOUND (${problems.fund.size}) — nothing imported for these:`)
  for (const f of problems.fund) console.log(`  ${f}`)
}
if (problems.sector.size) {
  console.log(`\nSECTOR TAGS NOT IN THE VOCABULARY (${problems.sector.size}) — dropped, not invented:`)
  for (const [t, n] of [...problems.sector].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}× ${t}`)
  console.log('  Add any that belong to an investor\'s sectors first, then re-run.')
}
if (problems.btype.size) {
  console.log(`\nBUSINESS TYPES NOT IN USE (${problems.btype.size}) — dropped:`)
  for (const [t, n] of [...problems.btype].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}× ${t}`)
}
if (problems.stage.size) console.log(`\nUNRECOGNISED STAGES (blanked): ${[...problems.stage].join(', ')}`)
if (problems.dupes.length) {
  console.log(`\nPOSSIBLE DUPLICATES (${problems.dupes.length}) — imported as-is, worth an eye:`)
  for (const d of problems.dupes) console.log(`  ${d}`)
}

if (!COMMIT) { console.log('\nDry run. Re-run with --commit to write.'); process.exit(0) }

let ok = 0, skipped = 0
for (const p of plan) {
  const { _fund, ...row } = p
  try {
    await api('investor_portfolio', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(row),
    })
    ok++
  } catch (e) {
    if (String(e.message).includes('23505')) { skipped++; continue }
    console.error(`FAILED ${p.company_name}: ${e.message.slice(0, 150)}`)
  }
  if (ok % 25 === 0 && ok) console.log(`  …${ok}`)
}
console.log(`\nimported ${ok} · already present ${skipped}`)
