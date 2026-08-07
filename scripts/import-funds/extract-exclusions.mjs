/**
 * Pull sector exclusions out of the fund notes.
 *
 *   node scripts/import-funds/extract-exclusions.mjs            # dry run
 *   node scripts/import-funds/extract-exclusions.mjs --commit
 *
 * The first import found exclusions in only 5 funds, because it only read the "sectors they invest
 * in" column. The notes column — imported later — turns out to carry many more, in prose:
 *
 *   "They avoid Ed tech and Fintech"
 *   "They dont do meat, alc and gambling. Not keen on SAAS right now"
 *   "Not interested in Crypto, Web3, deep tech and block chain"
 *   "no D2C or production/mfg based companies"
 *
 * Those are exactly the funds an investor list must not include, so leaving them unparsed defeats
 * the point of having the field.
 *
 * DELIBERATELY CONSERVATIVE. It only records an exclusion when a known sector name appears close
 * after an exclusion marker. Anything else is reported for a human rather than guessed at — an
 * earlier, looser pass produced exclusions like "they" and "very active", and a wrong exclusion
 * silently removes a fund from every future list.
 */
import fs from 'node:fs'

const COMMIT = process.argv.includes('--commit')

const env = Object.fromEntries(
  fs.readFileSync('C:/dev/ESV-Ecosystem/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// The canonical vocabulary, plus the non-sector things funds actually exclude.
const VOCAB = {
  'ed tech': 'EdTech', edtech: 'EdTech', education: 'EdTech',
  fintech: 'FinTech', 'fin tech': 'FinTech',
  'deep tech': 'DeepTech', deeptech: 'DeepTech',
  healthtech: 'HealthTech', 'health tech': 'HealthTech', healthcare: 'HealthTech',
  saas: 'SaaS', 'b2b saas': 'SaaS',
  d2c: 'D2C', b2c: 'D2C', 'consumer brands': 'Consumer', consumer: 'Consumer',
  marketplace: 'Marketplace', marketplaces: 'Marketplace',
  gaming: 'Gaming', 'real money gaming': 'Real-money gaming', rmg: 'Real-money gaming',
  crypto: 'Web3', web3: 'Web3', blockchain: 'Web3', 'block chain': 'Web3',
  // NOT tokenization -> Web3. Peercheque's note reads "Open to web3, no tokenization": mapping the
  // narrower term to the broader tag would have excluded a fund from exactly the sector it said it
  // wanted. A synonym that is really a subset inverts the meaning.
  agritech: 'AgriTech', 'agri tech': 'AgriTech',
  ecommerce: 'E-commerce', 'e-commerce': 'E-commerce',
  hardware: 'Hardware', robotics: 'Robotics', biotech: 'BioTech',
  meat: 'Meat', alcohol: 'Alcohol', alc: 'Alcohol', liquor: 'Alcohol',
  tobacco: 'Tobacco', gambling: 'Gambling', betting: 'Gambling',
  'asset heavy': 'Asset-heavy', 'asset-heavy': 'Asset-heavy',
  'offline businesses': 'Offline', mfg: 'Manufacturing', manufacturing: 'Manufacturing',
  'pet care': 'Pet care', gensets: 'Manufacturing',
}

// "no", "don't do", "avoid", "not interested in", "not keen on", "negative list".
const MARKER = /\b(?:no|not\s+interested(?:\s+in)?|not\s+keen(?:\s+on)?|don'?t\s+do|dont\s+do|do\s+not\s+do|avoid|avoids|steer\s+clear\s+of|negative\s+list\s*[-:]?)\b/gi

// How far after a marker a sector still counts as excluded. Short on purpose: prose moves on
// quickly, and "no pre revenue companies but we love fintech" must not exclude FinTech.
const WINDOW = 60

function extract(notes) {
  const found = new Map()
  const unmatched = []
  let m
  MARKER.lastIndex = 0
  while ((m = MARKER.exec(notes)) !== null) {
    const seg = notes.slice(m.index + m[0].length, m.index + m[0].length + WINDOW).toLowerCase()
    // Stop at a sentence boundary or a contrastive "but" — the exclusion ends there.
    const stop = seg.search(/[.;]|\bbut\b|\bhowever\b/)
    const scope = stop === -1 ? seg : seg.slice(0, stop)

    let hit = false
    for (const [k, v] of Object.entries(VOCAB)) {
      if (new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).test(scope)) {
        found.set(v, true); hit = true
      }
    }
    if (!hit) {
      const t = scope.trim().replace(/\s+/g, ' ').slice(0, 46)
      // "no pre revenue", "no leading rounds" — real conditions, but not sectors. Reported, not
      // invented into the tag list.
      if (t) unmatched.push(t)
    }
  }
  return { sectors: [...found.keys()], unmatched }
}

const res = await fetch(`${URL_}/rest/v1/investors?select=id,name,sectors,excluded_sectors,notes&notes=not.is.null`, { headers: H })
const funds = await res.json()

const plan = []
const review = []
for (const f of funds) {
  const { sectors, unmatched } = extract(f.notes)
  const already = new Set((f.excluded_sectors ?? []).map((s) => s.toLowerCase()))
  // Never exclude something the fund is also tagged as investing in — that contradiction needs a
  // person, not a script.
  const invests = new Set((f.sectors ?? []).map((s) => s.toLowerCase()))
  const add = sectors.filter((s) => !already.has(s.toLowerCase()))
  const conflict = add.filter((s) => invests.has(s.toLowerCase()))
  const safe = add.filter((s) => !invests.has(s.toLowerCase()))

  if (safe.length) {
    plan.push({ id: f.id, name: f.name, add: safe, existing: f.excluded_sectors ?? [], notes: f.notes })
  }
  if (conflict.length) review.push({ name: f.name, conflict, notes: f.notes.slice(0, 110) })
  if (unmatched.length) review.push({ name: f.name, unmatched, notes: null })
}

console.log(`${plan.length} funds would gain exclusions (currently 5 funds have any)\n`)
for (const p of plan) {
  console.log(`  ${p.name}`)
  console.log(`     + ${p.add.join(', ')}${p.existing.length ? `   (already: ${p.existing.join(', ')})` : ''}`)
  const m = p.notes.match(/.{0,40}\b(no|avoid|don'?t do|dont do|not interested|not keen|negative list)\b.{0,70}/i)
  if (m) console.log(`     from: …${m[0].replace(/\s+/g, ' ').trim()}…`)
}

const conflicts = review.filter((r) => r.conflict)
if (conflicts.length) {
  console.log(`\nNOT applied — the fund is tagged as investing in this AND the notes exclude it (${conflicts.length}).`)
  console.log('A contradiction needs a person:')
  for (const c of conflicts) console.log(`  ${c.name}: ${c.conflict.join(', ')}\n     "${c.notes.replace(/\s+/g,' ')}…"`)
}

const other = review.filter((r) => r.unmatched)
console.log(`\nExclusion phrases that are NOT sectors — left alone (${other.length} funds):`)
const seen = new Set()
for (const r of other) for (const u of r.unmatched) {
  if (seen.has(u) || seen.size >= 18) continue
  seen.add(u); console.log(`  "${u}"`)
}

if (!COMMIT) {
  console.log('\nDry run. Re-run with --commit to write.')
} else {
  let done = 0
  for (const p of plan) {
    const merged = [...new Set([...(p.existing ?? []), ...p.add])]
    const r = await fetch(`${URL_}/rest/v1/investors?id=eq.${p.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ excluded_sectors: merged }),
    })
    if (!r.ok) { console.error(`FAILED ${p.name}: ${(await r.text()).slice(0, 140)}`); continue }
    done++
  }
  console.log(`\nwrote exclusions to ${done} funds`)
}
