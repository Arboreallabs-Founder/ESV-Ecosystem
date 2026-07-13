// Companies bulk import — pure parse + validate (no DB). Mirrors the Deal Desk CSV importer so
// an AI agent can turn a list of startups into a company-shaped CSV. Rich child data (funding
// rounds, cap table, documents) is intentionally out of scope for a flat CSV.

import { COMPANY_STATUSES, type CompanyStatus, type CompanyFounder } from '@/lib/types'

export const COMPANY_CSV_COLUMNS = [
  'name',
  'legal_name',
  'website',
  'one_liner',
  'description',
  'hq_city',
  'hq_country',
  'sectors',
  'stage',
  'status',
  'business_model',
  'meta_tags',
  'arr_inr',
  'mrr_inr',
  'customers_count',
  'team_size',
  'gross_margin_percent',
  'monthly_burn_inr',
  'runway_months',
  'ask_inr',
  'instrument',
  'round_status',
  'total_raised_inr',
  'founder_names',
  'founder_roles',
  'founder_linkedin_urls',
  'founder_photo_urls',
] as const

export type ParsedCompany = {
  name: string
  legal_name: string | null
  website: string | null
  one_liner: string | null
  description: string | null
  hq_city: string | null
  hq_country: string | null
  sectors: string[]
  stage: string | null
  status: CompanyStatus | null
  business_model: string | null
  meta_tags: string[]
  arr_inr: number | null
  mrr_inr: number | null
  customers_count: number | null
  team_size: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  ask_inr: number | null
  instrument: string | null
  round_status: string | null
  total_raised_inr: number | null
  founders: CompanyFounder[]
}

export type CompanyCsvRowError = { row: number; message: string }
export type CompanyCsvParseResult = { rows: ParsedCompany[]; errors: CompanyCsvRowError[] }

// RFC-4180-ish parser (quotes, escaped quotes, embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

const clean = (v: string | undefined) => (v ?? '').trim()
const emptyToNull = (v: string) => (v === '' ? null : v)
const splitPipe = (v: string) => (v === '' ? [] : v.split('|').map((s) => s.trim()).filter(Boolean))
function parseNumber(raw: string, field: string): { value: number | null; error?: string } {
  const v = raw.trim()
  if (v === '') return { value: null }
  if (!/^-?\d+(\.\d+)?$/.test(v)) return { value: null, error: `${field} must be a plain number (got "${raw}")` }
  return { value: Number(v) }
}

export function parseCompaniesCsv(text: string): CompanyCsvParseResult {
  const matrix = parseCsv(text)
  const errors: CompanyCsvRowError[] = []
  const rows: ParsedCompany[] = []
  if (matrix.length === 0) return { rows: [], errors: [{ row: 0, message: 'The file is empty.' }] }

  const header = matrix[0].map((h) => h.trim())
  const validPrefix = header.length <= COMPANY_CSV_COLUMNS.length && header.every((h, i) => h === COMPANY_CSV_COLUMNS[i])
  if (!validPrefix) {
    return { rows: [], errors: [{ row: 1, message: `Header must be these columns in order (trailing ones optional): ${COMPANY_CSV_COLUMNS.join(', ')}` }] }
  }
  const colCount = header.length
  if (matrix.length === 1) return { rows: [], errors: [{ row: 1, message: 'No data rows found after the header.' }] }

  for (let r = 1; r < matrix.length; r++) {
    const rowNum = r + 1
    const cells = matrix[r]
    if (cells.length !== colCount) {
      errors.push({ row: rowNum, message: `Expected ${colCount} columns, found ${cells.length}. Check for unescaped commas.` })
      continue
    }
    const get = (name: typeof COMPANY_CSV_COLUMNS[number]) => clean(cells[COMPANY_CSV_COLUMNS.indexOf(name)])
    const rowErrors: string[] = []

    const name = get('name')
    if (!name) rowErrors.push('name is required')

    const statusRaw = get('status')
    let status: CompanyStatus | null = null
    if (statusRaw) {
      if (!(COMPANY_STATUSES as readonly string[]).includes(statusRaw)) rowErrors.push(`status "${statusRaw}" is not one of: ${COMPANY_STATUSES.join(', ')}`)
      else status = statusRaw as CompanyStatus
    }

    const nums = {
      arr_inr: parseNumber(get('arr_inr'), 'arr_inr'),
      mrr_inr: parseNumber(get('mrr_inr'), 'mrr_inr'),
      customers_count: parseNumber(get('customers_count'), 'customers_count'),
      team_size: parseNumber(get('team_size'), 'team_size'),
      gross_margin_pct: parseNumber(get('gross_margin_percent'), 'gross_margin_percent'),
      monthly_burn_inr: parseNumber(get('monthly_burn_inr'), 'monthly_burn_inr'),
      runway_months: parseNumber(get('runway_months'), 'runway_months'),
      ask_inr: parseNumber(get('ask_inr'), 'ask_inr'),
      total_raised_inr: parseNumber(get('total_raised_inr'), 'total_raised_inr'),
    }
    for (const n of Object.values(nums)) if (n.error) rowErrors.push(n.error)

    const founderNames = splitPipe(get('founder_names'))
    const founderRoles = splitPipe(get('founder_roles'))
    const founderUrls = splitPipe(get('founder_linkedin_urls'))
    const founderPhotos = splitPipe(get('founder_photo_urls'))
    const founders: CompanyFounder[] = []
    if (founderNames.length > 0) {
      const lenOk = [founderRoles, founderUrls, founderPhotos].every((l) => l.length === 0 || l.length === founderNames.length)
      if (!lenOk) rowErrors.push('founder_* lists must each have the same number of pipe-separated values as founder_names (or be empty)')
      else founderNames.forEach((n, i) => founders.push({
        name: n, role: emptyToNull(founderRoles[i] ?? ''), bio: null, ex_affiliations: null,
        linkedin_url: emptyToNull(founderUrls[i] ?? ''), photo_url: emptyToNull(founderPhotos[i] ?? ''), equity_pct: null,
      }))
    }

    if (rowErrors.length > 0) { errors.push({ row: rowNum, message: rowErrors.join('; ') }); continue }

    rows.push({
      name,
      legal_name: emptyToNull(get('legal_name')),
      website: emptyToNull(get('website')),
      one_liner: emptyToNull(get('one_liner')),
      description: emptyToNull(get('description')),
      hq_city: emptyToNull(get('hq_city')),
      hq_country: emptyToNull(get('hq_country')),
      sectors: splitPipe(get('sectors')),
      stage: emptyToNull(get('stage')),
      status,
      business_model: emptyToNull(get('business_model')),
      meta_tags: splitPipe(get('meta_tags')),
      arr_inr: nums.arr_inr.value,
      mrr_inr: nums.mrr_inr.value,
      customers_count: nums.customers_count.value,
      team_size: nums.team_size.value,
      gross_margin_pct: nums.gross_margin_pct.value,
      monthly_burn_inr: nums.monthly_burn_inr.value,
      runway_months: nums.runway_months.value,
      ask_inr: nums.ask_inr.value,
      instrument: emptyToNull(get('instrument')),
      round_status: emptyToNull(get('round_status')),
      total_raised_inr: nums.total_raised_inr.value,
      founders,
    })
  }
  return { rows, errors }
}

export const COMPANY_CSV_EXAMPLE_ROW =
  'Kyoora,Kyoora Health Pvt Ltd,https://kyoora.com,Digitising India\'s fragmented pharma distribution,B2B pharma distribution marketplace connecting chemists and distributors,Mumbai,India,Health tech|Marketplace,Series A,portfolio,B2B Marketplace,Healthtech|Marketplace|B2B|SaaS,1560000000,130000000,4200,140,58,90000000,14,400000000,Equity,Open,1200000000,Priya Shah|Rahul Mehta,CEO|CTO,https://linkedin.com/in/priyashah|https://linkedin.com/in/rahulmehta,https://kyoora.com/team/priya.jpg|https://kyoora.com/team/rahul.jpg'

export const COMPANY_CSV_HEADER = COMPANY_CSV_COLUMNS.join(',')
export const COMPANY_CSV_TEMPLATE = `${COMPANY_CSV_HEADER}\n${COMPANY_CSV_EXAMPLE_ROW}\n`

export const COMPANY_AI_INSTRUCTIONS = `You are turning a list of startups into a CSV for the ESV company database. I will paste the source list below these instructions.

OUTPUT RULES
- Deliver the result as a downloadable .csv file I can save and upload — not just text pasted into the chat. Name it "companies-import.csv".
- The file's contents are ONLY the CSV: a header row followed by one data row per company. No markdown fences, no commentary.
- Comma-delimited, UTF-8. Wrap a field in double quotes if its value contains a comma.
- For multi-value fields (sectors, meta_tags, founders) separate values with a pipe "|". Never use commas inside these.
- Leave a field empty if unknown — don't write "N/A", "-", or "None".
- Currency values are plain INR numbers — no ₹ symbol, no commas (e.g. 40000000).
- Existing companies are matched by name and updated in place (blank fields only) — they won't be duplicated.

COLUMNS — use exactly these names, in this exact order:
1.  name — REQUIRED, the brand/common name (e.g. "ElectriQ")
2.  legal_name — the registered entity (e.g. "Electriq Solutions Pvt Ltd")
3.  website — URL
4.  one_liner — a single line on what they do
5.  description — a short paragraph
6.  hq_city
7.  hq_country
8.  sectors — pipe-separated (e.g. "Fintech|SaaS")
9.  stage — free text (e.g. Seed, Pre-Series A, Series A)
10. status — one of EXACTLY: ${COMPANY_STATUSES.join(', ')}
11. business_model — short tag (e.g. "B2B SaaS", "D2C")
12. meta_tags — pipe-separated themes for investor matching; tag the model AND adjacent/synergetic themes (e.g. a D2C brand on quick-commerce → "D2C|Quick Commerce"). Prefer: Quick Commerce, D2C, SaaS, Marketplace, Subscription, AI/ML, Fintech, Healthtech, Climate, Deep Tech, Agritech, Edtech, Logistics, FMCG, Mobility, B2B, B2C
13. arr_inr — number
14. mrr_inr — number
15. customers_count — number
16. team_size — number
17. gross_margin_percent — number, e.g. 72
18. monthly_burn_inr — number
19. runway_months — number
20. ask_inr — number (current raise)
21. instrument — e.g. Equity, SAFE, Convertible
22. round_status — e.g. Open, Closing, Committed
23. total_raised_inr — number, total raised to date
24. founder_names — pipe-separated
25. founder_roles — pipe-separated, same order as founder_names
26. founder_linkedin_urls — pipe-separated, same order as founder_names
27. founder_photo_urls — pipe-separated headshot image URLs, same order as founder_names

EXAMPLE (header + one valid row):
${COMPANY_CSV_HEADER}
${COMPANY_CSV_EXAMPLE_ROW}

Now produce the CSV from the list I paste below. Output ONLY the CSV.`
