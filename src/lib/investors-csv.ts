// Investors bulk import — pure parse + validate (no DB). Mirrors the companies CSV importer
// so an AI agent can turn a list/deck of investors into an investor-shaped CSV. Sensitive
// fields (ESV POC, referral attribution, onboarding/KYC status) are intentionally out of scope
// for a flat CSV — those stay manual, set per-investor in the app.

import { SERVICE_TYPE_LABELS, type ServiceType } from '@/lib/types'

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]

export const INVESTOR_CSV_COLUMNS = [
  'name',
  'service_type',
  'country',
  'website',
  'stage',
  'sectors',
  'business_types',
  'meta_tags',
  'ticket_size_min',
  'ticket_size_max',
] as const

export type ParsedInvestor = {
  name: string
  service_type: ServiceType | null
  country: string | null
  website: string | null
  stage: string | null
  sectors: string[]
  business_types: string[]
  meta_tags: string[]
  ticket_size_min: number | null
  ticket_size_max: number | null
}

export type InvestorCsvRowError = { row: number; message: string }
export type InvestorCsvParseResult = { rows: ParsedInvestor[]; errors: InvestorCsvRowError[] }

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

export function parseInvestorsCsv(text: string): InvestorCsvParseResult {
  const matrix = parseCsv(text)
  const errors: InvestorCsvRowError[] = []
  const rows: ParsedInvestor[] = []
  if (matrix.length === 0) return { rows: [], errors: [{ row: 0, message: 'The file is empty.' }] }

  const header = matrix[0].map((h) => h.trim())
  const validPrefix = header.length <= INVESTOR_CSV_COLUMNS.length && header.every((h, i) => h === INVESTOR_CSV_COLUMNS[i])
  if (!validPrefix) {
    return { rows: [], errors: [{ row: 1, message: `Header must be these columns in order (trailing ones optional): ${INVESTOR_CSV_COLUMNS.join(', ')}` }] }
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
    const get = (name: typeof INVESTOR_CSV_COLUMNS[number]) => clean(cells[INVESTOR_CSV_COLUMNS.indexOf(name)])
    const rowErrors: string[] = []

    const name = get('name')
    if (!name) rowErrors.push('name is required')

    const serviceTypeRaw = get('service_type')
    let serviceType: ServiceType | null = null
    if (serviceTypeRaw) {
      if (!SERVICE_TYPES.includes(serviceTypeRaw as ServiceType)) rowErrors.push(`service_type "${serviceTypeRaw}" is not one of: ${SERVICE_TYPES.join(', ')}`)
      else serviceType = serviceTypeRaw as ServiceType
    }

    const ticketMin = parseNumber(get('ticket_size_min'), 'ticket_size_min')
    const ticketMax = parseNumber(get('ticket_size_max'), 'ticket_size_max')
    if (ticketMin.error) rowErrors.push(ticketMin.error)
    if (ticketMax.error) rowErrors.push(ticketMax.error)

    if (rowErrors.length > 0) { errors.push({ row: rowNum, message: rowErrors.join('; ') }); continue }

    rows.push({
      name,
      service_type: serviceType,
      country: emptyToNull(get('country')),
      website: emptyToNull(get('website')),
      stage: emptyToNull(get('stage')),
      sectors: splitPipe(get('sectors')),
      business_types: splitPipe(get('business_types')),
      meta_tags: splitPipe(get('meta_tags')),
      ticket_size_min: ticketMin.value,
      ticket_size_max: ticketMax.value,
    })
  }
  return { rows, errors }
}

export const INVESTOR_CSV_EXAMPLE_ROW =
  'Meridian Capital,vc_fund,India,https://meridiancap.example,Series A,Fintech|SaaS,B2B SaaS|Marketplace,AI/ML|Quick Commerce,20000000,100000000'

export const INVESTOR_CSV_HEADER = INVESTOR_CSV_COLUMNS.join(',')
export const INVESTOR_CSV_TEMPLATE = `${INVESTOR_CSV_HEADER}\n${INVESTOR_CSV_EXAMPLE_ROW}\n`

export const INVESTOR_AI_INSTRUCTIONS = `You are turning a list of investors into a CSV for the ESV investor database. I will paste the source list below these instructions.

OUTPUT RULES
- Deliver the result as a downloadable .csv file I can save and upload — not just text pasted into the chat. Name it "investors-import.csv".
- The file's contents are ONLY the CSV: a header row followed by one data row per investor. No markdown fences, no commentary.
- Comma-delimited, UTF-8. Wrap a field in double quotes if its value contains a comma.
- For multi-value fields (sectors, business_types, meta_tags) separate values with a pipe "|". Never use commas inside these.
- Leave a field empty if unknown — don't write "N/A", "-", or "None".
- Ticket sizes are plain INR numbers — no ₹ symbol, no commas (e.g. 20000000).
- Existing investors are matched by name and updated in place (blank fields only, tag lists are merged in) — they won't be duplicated.

COLUMNS — use exactly these names, in this exact order:
1.  name — REQUIRED, the fund or individual's name (e.g. "Meridian Capital")
2.  service_type — one of EXACTLY: ${SERVICE_TYPES.join(', ')} (leave blank if unsure; defaults to vc_fund for new records)
3.  country
4.  website — URL
5.  stage — investment stage preference, free text (e.g. Seed, Pre-Series A, Series A)
6.  sectors — pipe-separated (e.g. "Fintech|SaaS")
7.  business_types — pipe-separated, the kind of business models they favour (e.g. "B2B SaaS|Marketplace|D2C")
8.  meta_tags — pipe-separated, other thesis themes (e.g. "AI/ML|Quick Commerce|Climate|Deep Tech")
9.  ticket_size_min — number, minimum cheque size in INR
10. ticket_size_max — number, maximum cheque size in INR

EXAMPLE (header + one valid row):
${INVESTOR_CSV_HEADER}
${INVESTOR_CSV_EXAMPLE_ROW}

Now produce the CSV from the list I paste below. Output ONLY the CSV.`
