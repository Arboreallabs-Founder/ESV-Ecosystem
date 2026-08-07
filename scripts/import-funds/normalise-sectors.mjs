/**
 * Rewrite every sector label onto the one canonical vocabulary.
 *
 *   node scripts/import-funds/normalise-sectors.mjs            # dry run
 *   node scripts/import-funds/normalise-sectors.mjs --commit
 *
 * Three vocabularies had grown: the picker said "Fintech", investors said "FinTech", companies said
 * "Health tech". Nothing matched across them, which is why an investor list built for a defence
 * deal found no defence funds — the company was tagged "Defense" and every fund says "Defence".
 *
 * Touches companies.sectors, investors.sectors, investors.excluded_sectors and
 * investor_portfolio.sector_tags, so the whole graph speaks one language afterwards.
 *
 * Anything it cannot map is LEFT ALONE and reported. Dropping a tag it does not recognise would
 * quietly delete information; a label that survives unmapped is visible and fixable.
 */
import fs from 'node:fs'

const COMMIT = process.argv.includes('--commit')
const env = Object.fromEntries(
  fs.readFileSync('C:/dev/ESV-Ecosystem/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const get = async (q) => (await fetch(`${U}/rest/v1/${q}`, { headers: H })).json()
const patch = async (q, body) => {
  const r = await fetch(`${U}/rest/v1/${q}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
}

const canon = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const CANONICAL = [
  'Agnostic', 'AgriTech', 'AI/ML', 'AR/VR', 'B2B', 'Beauty', 'BioTech', 'ClimateTech', 'Consumer',
  'Cybersecurity', 'D2C', 'DeepTech', 'Defence', 'Drones', 'E-commerce', 'EdTech', 'Energy',
  'EV & Mobility', 'Fashion', 'FinTech', 'FoodTech', 'Gaming', 'Hardware', 'HealthTech', 'HRTech',
  'Infrastructure', 'IoT', 'LegalTech', 'Logistics', 'Manufacturing', 'Marketplace', 'Media',
  'Real Estate', 'Retail', 'Robotics', 'SaaS', 'SpaceTech', 'Sports', 'Travel', 'Web3',
]
const BY_CANON = new Map(CANONICAL.map((c) => [canon(c), c]))

/** Old spellings -> canonical. One label may legitimately become several. */
const ALIASES = {
  defense: ['Defence'],
  fmcg: ['Consumer', 'Retail'], food: ['FoodTech'], beverages: ['FoodTech', 'Consumer'],
  fnb: ['FoodTech'], consumergoods: ['Consumer'], consumerd2c: ['Consumer', 'D2C'],
  saasenterprisesoftware: ['SaaS', 'B2B'], enterprisesoftware: ['SaaS', 'B2B'], b2bservices: ['B2B'],
  devtoolsinfra: ['SaaS'], voiceaispeechtotext: ['AI/ML'], voiceai: ['AI/ML'],
  telecominfrastructure: ['Infrastructure'], digitalinfrastructure: ['Infrastructure'],
  industrialproducts: ['Manufacturing'], manufacturingindustrial: ['Manufacturing'],
  alternativelending: ['FinTech'], lending: ['FinTech'], parametricinsurance: ['FinTech'],
  insurance: ['FinTech'], insurtech: ['FinTech'], financialservices: ['FinTech'],
  climate: ['ClimateTech'], climatetechcleantech: ['ClimateTech'], cleantech: ['ClimateTech'],
  renewableenergy: ['Energy', 'ClimateTech'], cleanenergy: ['Energy', 'ClimateTech'],
  sustainability: ['ClimateTech'],
  mobility: ['EV & Mobility'], evmobility: ['EV & Mobility'], mobilityev: ['EV & Mobility'],
  lastmiledelivery: ['Logistics'], logisticssupplychain: ['Logistics'], supplychain: ['Logistics'],
  warehousing: ['Logistics'], transport: ['EV & Mobility'], transportation: ['EV & Mobility'],
  staffingfacilitymanagement: ['HRTech'], staffing: ['HRTech'], hrtech: ['HRTech'],
  healthcare: ['HealthTech'], pharma: ['HealthTech', 'BioTech'], biotechpharma: ['BioTech'],
  medtech: ['HealthTech'], fitness: ['HealthTech'],
  ecommerce: ['E-commerce'], commerce: ['E-commerce'],
  b2bmarketplace: ['Marketplace', 'B2B'], consumermarketplace: ['Marketplace', 'Consumer'],
  proptech: ['Real Estate'], realestate: ['Real Estate'],
  web3crypto: ['Web3'], crypto: ['Web3'], blockchain: ['Web3'],
  mediaentertainment: ['Media'], entertainment: ['Media'], social: ['Media'],
  travelhospitality: ['Travel'], hospitality: ['Travel'],
  legaltech: ['LegalTech'], spacetech: ['SpaceTech'], aerospace: ['SpaceTech'],
  ai: ['AI/ML'], ml: ['AI/ML'], artificialintelligence: ['AI/ML'],
  agriculture: ['AgriTech'], agri: ['AgriTech'], edutech: ['EdTech'], education: ['EdTech'],
  sportstech: ['Sports'], drone: ['Drones'], dronetech: ['Drones'],
  infra: ['Infrastructure'], b2c: ['Consumer'], enterprise: ['B2B'], enterprisetech: ['B2B'],
  tech: [], technology: [],   // too vague to keep — mapped to nothing, deliberately
  ev: ['EV & Mobility'], heathcare: ['HealthTech'], any: ['Agnostic'],
}

/**
 * Concepts that only ever appear in excluded_sectors: things a fund refuses, not sectors it backs.
 * "Meat", "Alcohol", "Gambling", "Asset-heavy" are not investment sectors and do not belong in
 * SECTOR_OPTIONS — but deleting them would erase the exclusions that keep an embarrassing fund off
 * an investor list. They pass through untouched and are not reported as a problem.
 */
const EXCLUSION_ONLY = new Set([
  'meat', 'alcohol', 'gambling', 'realmoneygaming', 'tobacco', 'adultcontent', 'weapons',
  'assetheavy', 'offline', 'hardwareheavy', 'petcare',
].map((x) => x))

const unmapped = new Map()
function normalise(tags) {
  const out = new Set()
  let changed = false
  for (const t of tags ?? []) {
    const direct = BY_CANON.get(canon(t))
    if (direct) { out.add(direct); if (direct !== t) changed = true; continue }
    const alias = ALIASES[canon(t)]
    if (alias) {
      if (alias.length === 0) { changed = true; continue }   // deliberately dropped
      alias.forEach((a) => out.add(a)); changed = true; continue
    }
    out.add(t)                                               // keep either way
    // An exclusion-only concept is expected here, not a gap in the vocabulary.
    if (!EXCLUSION_ONLY.has(canon(t))) unmapped.set(t, (unmapped.get(t) ?? 0) + 1)
  }
  return { tags: [...out], changed }
}

const jobs = [
  { table: 'companies', select: 'id,name,sectors', field: 'sectors' },
  { table: 'investors', select: 'id,name,sectors', field: 'sectors' },
  { table: 'investors', select: 'id,name,excluded_sectors', field: 'excluded_sectors' },
  { table: 'investor_portfolio', select: 'id,company_name,sector_tags', field: 'sector_tags' },
]

let totalChanged = 0
for (const job of jobs) {
  const rows = await get(`${job.table}?select=${job.select}`)
  const edits = []
  for (const r of rows) {
    const { tags, changed } = normalise(r[job.field])
    if (changed) edits.push({ id: r.id, label: r.name ?? r.company_name, before: r[job.field], after: tags })
  }
  console.log(`\n${job.table}.${job.field}: ${edits.length} of ${rows.length} rows change`)
  for (const e of edits.slice(0, 6)) {
    console.log(`   ${e.label}: [${e.before.join(', ')}] -> [${e.after.join(', ')}]`)
  }
  if (edits.length > 6) console.log(`   …and ${edits.length - 6} more`)
  totalChanged += edits.length

  if (COMMIT) {
    for (const e of edits) await patch(`${job.table}?id=eq.${e.id}`, { [job.field]: e.after })
    console.log(`   written`)
  }
}

if (unmapped.size) {
  console.log(`\nLABELS WITH NO CANONICAL EQUIVALENT (${unmapped.size}) — left untouched, not deleted:`)
  for (const [t, n] of [...unmapped].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}× ${t}`)
  console.log('   Add each to SECTOR_OPTIONS or to ALIASES here, then re-run.')
}

console.log(`\n${totalChanged} rows ${COMMIT ? 'updated' : 'would change'}`)
if (!COMMIT) console.log('Dry run. Re-run with --commit to write.')
