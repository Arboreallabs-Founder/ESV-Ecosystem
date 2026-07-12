// Deal Desk CSV import — pure parse + validate (no DB access).
// Imported by BOTH the client-side preview and the server action so validation is
// identical and the server stays authoritative. Batch supported (N data rows per file).

import {
  DESK_STAGES,
  DESK_VALUATION_TYPES,
  DESK_REVENUE_STATUSES,
  DESK_REVENUE_PERIODS,
  DESK_INSTRUMENTS,
  DESK_ROUND_STATUSES,
  type DeskFounder,
  type DeskRevenuePoint,
  type DeskStage,
  type DeskValuationType,
  type DeskRevenueStatus,
  type DeskRevenuePeriod,
  type DeskInstrument,
  type DeskRoundStatus,
} from '@/lib/types'

// The exact column order the AI agent must emit (spec §5).
export const CSV_COLUMNS = [
  'company_name',
  'sector',
  'about',
  'location',
  'stage',
  'ask_inr',
  'valuation_type',
  'valuation_inr',
  'dilution_percent',
  'cap_table_notable_names',
  'cap_table_structure_notes',
  'revenue_status',
  'revenue_period_type',
  'revenue_data',
  'usp',
  'founder_names',
  'founder_affiliations',
  'founder_bios',
  'founder_linkedin_urls',
  'pitch_deck_url',
  'notes',
  'call_date',
  // Tier-2 enrichment columns (optional; appended so older 22-column CSVs still import).
  'business_model',
  'instrument',
  'round_status',
  'committed_inr',
  'total_raised_inr',
  'gross_margin_percent',
  'monthly_burn_inr',
  'runway_months',
  'customers_count',
] as const

// A validated deal ready to insert (DB column names; excludes org_id/associate_id which
// the server supplies from the session).
export type ParsedDeskDeal = {
  company_name: string
  sector: string | null
  about: string | null
  location: string | null
  stage: DeskStage | null
  ask_inr: number | null
  valuation_type: DeskValuationType | null
  valuation_inr: number | null
  dilution_percent: number | null
  cap_table_notable_names: string[]
  cap_table_structure_notes: string | null
  revenue_status: DeskRevenueStatus | null
  revenue_period: DeskRevenuePeriod | null
  revenue_data: DeskRevenuePoint[]
  usp: string | null
  founders: DeskFounder[]
  pitch_deck_url: string | null
  notes: string | null
  call_date: string | null
  business_model: string | null
  instrument: DeskInstrument | null
  round_status: DeskRoundStatus | null
  committed_inr: number | null
  total_raised_inr: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  customers_count: number | null
}

export type CsvRowError = { row: number; message: string }

export type CsvParseResult = {
  rows: ParsedDeskDeal[]
  errors: CsvRowError[]
}

// ── RFC-4180-ish field parser: handles quoted fields, escaped quotes, embedded commas
//    and newlines. Returns a matrix of raw string cells. ─────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  // Normalise line endings; strip a UTF-8 BOM if present.
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  // Flush trailing field/row (file may not end with a newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

const clean = (v: string | undefined): string => (v ?? '').trim()
const emptyToNull = (v: string): string | null => (v === '' ? null : v)
const splitPipe = (v: string): string[] => (v === '' ? [] : v.split('|').map((s) => s.trim()))

// Numbers must be plain: no ₹, no thousands separators, no letters.
function parseNumber(raw: string, field: string): { value: number | null; error?: string } {
  const v = raw.trim()
  if (v === '') return { value: null }
  if (!/^-?\d+(\.\d+)?$/.test(v)) {
    return { value: null, error: `${field} must be a plain number with no symbols or separators (got "${raw}")` }
  }
  return { value: Number(v) }
}

/**
 * Parse and validate a Deal Desk CSV. Every row is checked against the enum lists,
 * required fields, char limits, and cross-field rules; a bad row is rejected with a
 * specific message rather than silently coerced. Valid rows are still returned so a
 * partial import can proceed for the good ones.
 */
export function parseDeskCsv(text: string): CsvParseResult {
  const matrix = parseCsv(text)
  const errors: CsvRowError[] = []
  const rows: ParsedDeskDeal[] = []

  if (matrix.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'The file is empty.' }] }
  }

  // Header validation — must be a correct in-order PREFIX of the known columns. This lets an
  // older CSV (the original 22 columns) import fine while newer files add the Tier-2 columns.
  const header = matrix[0].map((h) => h.trim())
  const validPrefix = header.length <= CSV_COLUMNS.length && header.every((h, i) => h === CSV_COLUMNS[i])
  if (!validPrefix) {
    return {
      rows: [],
      errors: [{
        row: 1,
        message: `Header must be these columns in order (trailing ones optional): ${CSV_COLUMNS.join(', ')}`,
      }],
    }
  }
  const colCount = header.length

  if (matrix.length === 1) {
    return { rows: [], errors: [{ row: 1, message: 'No data rows found after the header.' }] }
  }

  for (let r = 1; r < matrix.length; r++) {
    const rowNum = r + 1 // 1-indexed, header is row 1
    const cells = matrix[r]
    if (cells.length !== colCount) {
      errors.push({ row: rowNum, message: `Expected ${colCount} columns, found ${cells.length}. Check for unescaped commas.` })
      continue
    }

    // Columns beyond this file's header are treated as empty (optional trailing fields).
    const get = (name: typeof CSV_COLUMNS[number]) => clean(cells[CSV_COLUMNS.indexOf(name)])
    const rowErrors: string[] = []

    // company_name — required, ≤40
    const company_name = get('company_name')
    if (!company_name) rowErrors.push('company_name is required')
    else if (company_name.length > 40) rowErrors.push('company_name exceeds 40 characters')

    // about / location — ≤50
    const about = get('about')
    if (about.length > 50) rowErrors.push('about exceeds 50 characters')
    const location = get('location')
    if (location.length > 50) rowErrors.push('location exceeds 50 characters')

    // stage — enum (optional)
    const stageRaw = get('stage')
    let stage: DeskStage | null = null
    if (stageRaw) {
      if (!(DESK_STAGES as readonly string[]).includes(stageRaw)) {
        rowErrors.push(`stage "${stageRaw}" is not one of: ${DESK_STAGES.join(', ')}`)
      } else stage = stageRaw as DeskStage
    }

    // ask_inr — number
    const ask = parseNumber(get('ask_inr'), 'ask_inr')
    if (ask.error) rowErrors.push(ask.error)

    // valuation_type — enum; valuation_inr required-if-Fixed
    const valTypeRaw = get('valuation_type')
    let valuation_type: DeskValuationType | null = null
    if (valTypeRaw) {
      if (!(DESK_VALUATION_TYPES as readonly string[]).includes(valTypeRaw)) {
        rowErrors.push(`valuation_type "${valTypeRaw}" must be Fixed or TBD`)
      } else valuation_type = valTypeRaw as DeskValuationType
    }
    const valAmount = parseNumber(get('valuation_inr'), 'valuation_inr')
    if (valAmount.error) rowErrors.push(valAmount.error)
    if (valuation_type === 'Fixed' && valAmount.value === null) {
      rowErrors.push('valuation_inr is required when valuation_type is Fixed')
    }
    if (valuation_type === 'TBD' && valAmount.value !== null) {
      rowErrors.push('valuation_inr must be empty when valuation_type is TBD')
    }

    // dilution_percent — number
    const dilution = parseNumber(get('dilution_percent'), 'dilution_percent')
    if (dilution.error) rowErrors.push(dilution.error)

    // revenue_status — enum; period + data conditional
    const revStatusRaw = get('revenue_status')
    let revenue_status: DeskRevenueStatus | null = null
    if (revStatusRaw) {
      if (!(DESK_REVENUE_STATUSES as readonly string[]).includes(revStatusRaw)) {
        rowErrors.push(`revenue_status "${revStatusRaw}" is not one of: ${DESK_REVENUE_STATUSES.join(', ')}`)
      } else revenue_status = revStatusRaw as DeskRevenueStatus
    }

    const revPeriodRaw = get('revenue_period_type')
    let revenue_period: DeskRevenuePeriod | null = null
    if (revPeriodRaw) {
      if (!(DESK_REVENUE_PERIODS as readonly string[]).includes(revPeriodRaw)) {
        rowErrors.push(`revenue_period_type "${revPeriodRaw}" must be Monthly or Annual`)
      } else revenue_period = revPeriodRaw as DeskRevenuePeriod
    }

    // revenue_data — pipe-separated period:amount pairs
    const revenue_data: DeskRevenuePoint[] = []
    const revDataRaw = get('revenue_data')
    if (revDataRaw) {
      for (const pair of splitPipe(revDataRaw)) {
        const idx = pair.lastIndexOf(':')
        const period = idx >= 0 ? pair.slice(0, idx).trim() : ''
        const amountStr = idx >= 0 ? pair.slice(idx + 1).trim() : ''
        const amount = parseNumber(amountStr, 'revenue_data amount')
        if (!period || idx < 0 || amount.error || amount.value === null) {
          rowErrors.push(`revenue_data entry "${pair}" must be in period:amount form (e.g. 2026-01:1500000)`)
        } else {
          revenue_data.push({ period, amount: amount.value })
        }
      }
    }
    if (revenue_status === 'Yes') {
      if (!revenue_period) rowErrors.push('revenue_period_type is required when revenue_status is Yes')
      if (revenue_data.length === 0) rowErrors.push('revenue_data must have at least one point when revenue_status is Yes')
    }
    if (revenue_status === 'No' && (revenue_period || revenue_data.length > 0)) {
      rowErrors.push('revenue_period_type and revenue_data must be empty when revenue_status is No')
    }

    // Founders — parallel pipe lists; names drives the count.
    const founderNames = splitPipe(get('founder_names'))
    const founderAffs = splitPipe(get('founder_affiliations'))
    const founderBios = splitPipe(get('founder_bios'))
    const founderUrls = splitPipe(get('founder_linkedin_urls'))
    const founders: DeskFounder[] = []
    if (founderNames.length > 0) {
      const lenOk = [founderAffs, founderBios, founderUrls].every(
        (l) => l.length === 0 || l.length === founderNames.length,
      )
      if (!lenOk) {
        rowErrors.push('founder_* lists must each have the same number of pipe-separated values as founder_names (or be empty)')
      } else {
        founderNames.forEach((name, i) => {
          const bio = founderBios[i] ?? ''
          if (bio.length > 50) rowErrors.push(`founder bio for "${name}" exceeds 50 characters`)
          founders.push({
            name,
            affiliation: emptyToNull(founderAffs[i] ?? ''),
            bio: emptyToNull(bio),
            linkedin_url: emptyToNull(founderUrls[i] ?? ''),
          })
        })
      }
    }

    // call_date — YYYY-MM-DD (optional)
    const callDateRaw = get('call_date')
    let call_date: string | null = null
    if (callDateRaw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(callDateRaw) || Number.isNaN(Date.parse(callDateRaw))) {
        rowErrors.push(`call_date "${callDateRaw}" must be a valid date in YYYY-MM-DD format`)
      } else call_date = callDateRaw
    }

    // ── Tier-2 enrichment fields (all optional) ──
    const instrumentRaw = get('instrument')
    let instrument: DeskInstrument | null = null
    if (instrumentRaw) {
      if (!(DESK_INSTRUMENTS as readonly string[]).includes(instrumentRaw)) {
        rowErrors.push(`instrument "${instrumentRaw}" must be one of: ${DESK_INSTRUMENTS.join(', ')}`)
      } else instrument = instrumentRaw as DeskInstrument
    }

    const roundStatusRaw = get('round_status')
    let round_status: DeskRoundStatus | null = null
    if (roundStatusRaw) {
      if (!(DESK_ROUND_STATUSES as readonly string[]).includes(roundStatusRaw)) {
        rowErrors.push(`round_status "${roundStatusRaw}" must be one of: ${DESK_ROUND_STATUSES.join(', ')}`)
      } else round_status = roundStatusRaw as DeskRoundStatus
    }

    const committed = parseNumber(get('committed_inr'), 'committed_inr')
    if (committed.error) rowErrors.push(committed.error)
    const totalRaised = parseNumber(get('total_raised_inr'), 'total_raised_inr')
    if (totalRaised.error) rowErrors.push(totalRaised.error)
    const grossMargin = parseNumber(get('gross_margin_percent'), 'gross_margin_percent')
    if (grossMargin.error) rowErrors.push(grossMargin.error)
    const burn = parseNumber(get('monthly_burn_inr'), 'monthly_burn_inr')
    if (burn.error) rowErrors.push(burn.error)
    const runway = parseNumber(get('runway_months'), 'runway_months')
    if (runway.error) rowErrors.push(runway.error)
    const customers = parseNumber(get('customers_count'), 'customers_count')
    if (customers.error) rowErrors.push(customers.error)

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, message: rowErrors.join('; ') })
      continue
    }

    rows.push({
      company_name,
      sector: emptyToNull(get('sector')),
      about: emptyToNull(about),
      location: emptyToNull(location),
      stage,
      ask_inr: ask.value,
      valuation_type,
      valuation_inr: valAmount.value,
      dilution_percent: dilution.value,
      cap_table_notable_names: splitPipe(get('cap_table_notable_names')),
      cap_table_structure_notes: emptyToNull(get('cap_table_structure_notes')),
      revenue_status,
      revenue_period,
      revenue_data,
      usp: emptyToNull(get('usp')),
      founders,
      pitch_deck_url: emptyToNull(get('pitch_deck_url')),
      notes: emptyToNull(get('notes')),
      call_date,
      business_model: emptyToNull(get('business_model')),
      instrument,
      round_status,
      committed_inr: committed.value,
      total_raised_inr: totalRaised.value,
      gross_margin_pct: grossMargin.value,
      monthly_burn_inr: burn.value,
      runway_months: runway.value,
      customers_count: customers.value,
    })
  }

  return { rows, errors }
}

// A ready-to-use example data row (the Kyoora sample from the spec), correctly quoted.
export const CSV_EXAMPLE_ROW =
  'Kyoora Ventures,Deep tech,AI-driven drug discovery platform,"Mumbai, India",Series A,40000000,Fixed,800000000,5,Sequoia Surge|Blume Ventures,"Priced round, no bridge notes",Yes,Monthly,2026-01:1500000|2026-02:1800000|2026-03:2100000,3 enterprise LOIs signed pre-round,Priya Shah|Rahul Mehta,Ex-Google DeepMind|Ex-Flipkart,Led ML team at DeepMind for 6 years|Built and scaled Flipkart\'s fraud stack,https://linkedin.com/in/priyashah|https://linkedin.com/in/rahulmehta,https://drive.google.com/xyz,3 enterprise LOIs signed pre-round; 40% MoM growth; strong technical team; runway into Q4 2026,2026-07-10,B2B Deep tech,Equity,Open,15000000,60000000,72,2500000,18,8'

// The header row on its own.
export const CSV_HEADER = CSV_COLUMNS.join(',')

// Downloadable template: header + one worked example row.
export const CSV_TEMPLATE = `${CSV_HEADER}\n${CSV_EXAMPLE_ROW}\n`

// The full, self-contained prompt an associate pastes into their AI agent along with their
// call notes. Includes every column's format, character limits and allowed values so the
// agent can produce a valid CSV in one shot.
export const AI_AGENT_INSTRUCTIONS = `You are turning my raw first-level startup call notes into a single CSV row (or one row per deal) for the ESV Deal Desk. I will paste my notes below these instructions.

OUTPUT RULES
- Deliver the result as a downloadable .csv file that I can save to my device and upload — not just CSV text pasted into the chat. Name the file "deal-desk-import.csv".
- The file's contents are ONLY the CSV: a header row followed by one data row per deal. No markdown code fences, no commentary, no extra text before or after.
- Comma-delimited, UTF-8 encoding.
- If a field's value contains a comma, wrap that whole field in double quotes (e.g. "Mumbai, India").
- For fields that hold multiple values (founders, cap table names, revenue data) separate the values with a pipe "|". Never use commas inside these fields.
- Leave a field empty if it doesn't apply — do not write "N/A", "-", or "None".
- Currency values are plain numbers in INR — no ₹ symbol and no thousands separators (e.g. 4000000, not ₹40,00,000).
- Character limits are HARD limits. Truncate the text rather than exceed them.

COLUMNS — use exactly these names, in this exact order:
1.  company_name — text, REQUIRED, max 40 characters
2.  sector — text; used for colour-coding, so prefer one of: Deep tech, Climate tech, Health tech, Consumer, Fintech, SaaS, Agritech
3.  about — text, max 50 characters, one line
4.  location — text, max 50 characters
5.  stage — one of EXACTLY: MVP, Pre-Seed, Seed, Pre-Series A, Series A, Series A+
6.  ask_inr — number only, no symbols or separators
7.  valuation_type — EXACTLY Fixed or TBD
8.  valuation_inr — number if valuation_type is Fixed, otherwise leave empty
9.  dilution_percent — number, e.g. 5
10. cap_table_notable_names — pipe-separated list, e.g. Investor A|Investor B; empty if none
11. cap_table_structure_notes — free text, one line
12. revenue_status — one of EXACTLY: Yes, Negligible, No
13. revenue_period_type — Monthly or Annual; empty if revenue_status is No
14. revenue_data — pipe-separated period:amount pairs, e.g. 2026-01:1500000|2026-02:1800000; empty if revenue_status is No; MUST have at least one point if revenue_status is Yes
15. usp — free text, optional, one line
16. founder_names — pipe-separated, e.g. Priya Shah|Rahul Mehta
17. founder_affiliations — pipe-separated, same order as founder_names
18. founder_bios — pipe-separated, same order as founder_names, max 50 characters EACH
19. founder_linkedin_urls — pipe-separated, same order as founder_names
20. pitch_deck_url — URL, empty if none
21. notes — optional; write as SEMICOLON-separated short facts / traction proof points, not flowing prose (e.g. "120M+ views in 11 days; 3 enterprise LOIs signed; 40% MoM growth"). These render as a numbered list.
22. call_date — date in YYYY-MM-DD format
23. business_model — optional short tag, e.g. "B2B SaaS", "D2C", "Marketplace", "B2B Deep tech"
24. instrument — optional; EXACTLY one of: Equity, SAFE, Convertible, Other
25. round_status — optional; EXACTLY one of: Open, Closing, Committed
26. committed_inr — optional number; amount committed in THIS round so far (plain INR)
27. total_raised_inr — optional number; total raised to date across prior rounds (plain INR)
28. gross_margin_percent — optional number, e.g. 72
29. monthly_burn_inr — optional number; monthly cash burn (plain INR)
30. runway_months — optional number, e.g. 18
31. customers_count — optional number; paying customers or active users

EXAMPLE (header + one valid row):
${CSV_HEADER}
${CSV_EXAMPLE_ROW}

Now produce the CSV from the notes I paste below. Remember: output ONLY the CSV.`
