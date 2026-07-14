// Active-deal bulk import — pure parse + validate (no DB). The columns are DYNAMIC: they're
// generated from the org's configured deal categories and their fields, so an AI agent (or a
// human) can turn a portfolio / legacy-deal list into a CSV that matches this org exactly.
// A row belongs to at most one category; fill only that category's columns.

import type { DealCategory } from '@/lib/types'

export type ParsedDealRow = {
  deal_name: string
  category_id: string | null
  submitter_name: string | null
  submitter_email: string | null
  field_values: Record<string, string> // field_id → value
}
export type DealCsvRowError = { row: number; message: string }
export type DealCsvParseResult = { rows: ParsedDealRow[]; errors: DealCsvRowError[] }

const FIXED_COLUMNS = ['deal_name', 'category', 'submitter_name', 'submitter_email'] as const

// A category field's column header, namespaced by category so identically-named fields don't clash.
function fieldColumn(catName: string, fieldLabel: string): string {
  return `${catName}: ${fieldLabel}`
}

/** Full ordered column list for the given categories. */
export function buildDealCsvColumns(categories: DealCategory[]): string[] {
  const cols: string[] = [...FIXED_COLUMNS]
  for (const cat of categories) for (const f of cat.fields) cols.push(fieldColumn(cat.name, f.label))
  return cols
}

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

// Numeric-ish fields store a clean number string; strip grouping so the card can re-format it.
function cleanNumeric(v: string): string {
  const stripped = v.replace(/,/g, '').trim()
  return /^-?\d+(\.\d+)?$/.test(stripped) ? stripped : v.trim()
}

export function parseDealsCsv(text: string, categories: DealCategory[]): DealCsvParseResult {
  const matrix = parseCsv(text)
  const errors: DealCsvRowError[] = []
  const rows: ParsedDealRow[] = []
  if (matrix.length === 0) return { rows: [], errors: [{ row: 0, message: 'The file is empty.' }] }

  // Header → column index (flexible order; match on label).
  const header = matrix[0].map((h) => h.trim())
  const colOf = new Map<string, number>()
  header.forEach((h, i) => { if (!colOf.has(h)) colOf.set(h, i) })
  if (!colOf.has('deal_name')) {
    return { rows: [], errors: [{ row: 1, message: 'Missing required "deal_name" column. Download the template for the exact headers.' }] }
  }
  if (matrix.length === 1) return { rows: [], errors: [{ row: 1, message: 'No data rows found after the header.' }] }

  const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))

  for (let r = 1; r < matrix.length; r++) {
    const rowNum = r + 1
    const cells = matrix[r]
    const cell = (label: string): string => {
      const idx = colOf.get(label)
      return idx === undefined ? '' : (cells[idx] ?? '').trim()
    }
    const rowErrors: string[] = []

    const deal_name = cell('deal_name')
    if (!deal_name) rowErrors.push('deal_name is required')

    const catRaw = cell('category')
    let category: DealCategory | null = null
    if (catRaw) {
      category = catByName.get(catRaw.toLowerCase()) ?? null
      if (!category) rowErrors.push(`category "${catRaw}" doesn't match any configured category (${categories.map((c) => c.name).join(', ') || 'none'})`)
    }

    const field_values: Record<string, string> = {}
    if (category) {
      for (const f of category.fields) {
        const raw = cell(fieldColumn(category.name, f.label))
        if (raw === '') continue
        field_values[f.id] = (f.field_type === 'numeric' || f.field_type === 'percentage') ? cleanNumeric(raw) : raw
      }
    }

    if (rowErrors.length > 0) { errors.push({ row: rowNum, message: rowErrors.join('; ') }); continue }

    rows.push({
      deal_name,
      category_id: category?.id ?? null,
      submitter_name: cell('submitter_name') || null,
      submitter_email: cell('submitter_email') || null,
      field_values,
    })
  }
  return { rows, errors }
}

// ── Template + AI prompt (both dynamic) ──────────────────────────────────────

export function buildDealCsvHeader(categories: DealCategory[]): string {
  return buildDealCsvColumns(categories).map(csvCell).join(',')
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// One illustrative row using the first category (if any).
function exampleRow(categories: DealCategory[]): string {
  const cols = buildDealCsvColumns(categories)
  const first = categories[0]
  const values = new Map<string, string>([
    ['deal_name', 'Arboreal Labs'],
    ['category', first?.name ?? ''],
    ['submitter_name', 'Siddhant'],
    ['submitter_email', 'founders@arboreallabs.com'],
  ])
  if (first) {
    first.fields.forEach((f, i) => {
      const sample = f.field_type === 'numeric' ? String(10000000 * (i + 1))
        : f.field_type === 'percentage' ? '5'
        : f.field_type === 'url' ? 'https://example.com'
        : 'Example'
      values.set(fieldColumn(first.name, f.label), sample)
    })
  }
  return cols.map((c) => csvCell(values.get(c) ?? '')).join(',')
}

export function buildDealCsvTemplate(categories: DealCategory[]): string {
  return `${buildDealCsvHeader(categories)}\n${exampleRow(categories)}\n`
}

export function buildDealAiInstructions(categories: DealCategory[]): string {
  const catBlocks = categories.length === 0
    ? '(No categories are configured yet — leave "category" blank and only fill deal_name / submitter columns.)'
    : categories.map((c) => {
        const fields = c.fields.length === 0
          ? '   (no fields)'
          : c.fields.map((f) => `   - "${fieldColumn(c.name, f.label)}" — ${f.field_type}`).join('\n')
        return `• ${c.name}\n${fields}`
      }).join('\n')

  return `You are turning a list of deals (portfolio companies, legacy or off-pipeline deals) into a CSV for the ESV Active Deals database. I will paste the source list below these instructions.

OUTPUT RULES
- Deliver the result as a downloadable .csv file I can save and upload — not just text pasted into the chat. Name it "active-deals-import.csv".
- The file's contents are ONLY the CSV: a header row followed by one data row per deal. No markdown fences, no commentary.
- Comma-delimited, UTF-8. Wrap a field in double quotes if its value contains a comma.
- Leave a field empty if unknown — don't write "N/A", "-", or "None".
- Numbers are plain — no ₹ symbol, no thousands commas (e.g. 100000000, not 10,00,00,000). The app adds separators on display.
- Each deal belongs to at most ONE category. Put the category's exact name in the "category" column, then fill ONLY that category's columns (below); leave every other category's columns blank. Leave "category" blank for an uncategorised deal.
- Every deal creates or links a company profile by name (deduped), so the deal shows on that company's profile.

FIXED COLUMNS (always present):
- deal_name — REQUIRED, the company / deal name
- category — the category name, exactly as listed below (or blank)
- submitter_name — optional contact name
- submitter_email — optional contact email

CATEGORY COLUMNS — use the exact header text shown in quotes, only for the row's chosen category:
${catBlocks}

Use exactly this header row (in this order):
${buildDealCsvHeader(categories)}

Now produce the CSV from the list I paste below. Output ONLY the CSV.`
}
