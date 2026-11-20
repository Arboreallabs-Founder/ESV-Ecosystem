import type { CompanyFieldType } from '@/lib/types'

/**
 * Company custom fields: what each type accepts, how it's stored, and how it's shown.
 *
 * One module for the profile page, the call-update modal, the server action and the AI connector,
 * so a value Claude writes is validated and displayed exactly like one typed into the UI.
 *
 * Storage is always the TEXT column company_field_values.value:
 *   numeric / percentage / currency → raw number string ("1234567.5"); formatting is display-only
 *   checkbox     → 'true' | 'false'
 *   multi_select → JSON array string ('["Fintech","SaaS"]')
 *   everything else → the text itself
 */

export type CurrencyUnit = 'rupees' | 'lakh' | 'crore'

export type CompanyFieldConfig = {
  /** numeric / percentage / currency: digits after the decimal point (0–6). */
  decimals?: number
  /** numeric / percentage: group thousands. Indian grouping (12,34,567), like the rest of the app. */
  thousands?: boolean
  /** currency: show as plain rupees, or scaled to Lakh / Crore. */
  unit?: CurrencyUnit
  /** select / multi_select: the allowed values, in display order. */
  options?: string[]
}

export const FIELD_TYPE_LABELS: Record<CompanyFieldType, string> = {
  text: 'Text',
  long_text: 'Long text',
  numeric: 'Number',
  currency: 'Currency (₹)',
  percentage: 'Percentage',
  date: 'Date',
  url: 'URL',
  email: 'Email',
  phone: 'Phone',
  checkbox: 'Checkbox',
  select: 'Dropdown',
  multi_select: 'Multi-select',
}

export const CURRENCY_UNIT_LABELS: Record<CurrencyUnit, string> = { rupees: '₹', lakh: '₹ Lakh', crore: '₹ Crore' }

const NUMERIC_TYPES: CompanyFieldType[] = ['numeric', 'percentage', 'currency']
export const isNumericType = (t: CompanyFieldType) => NUMERIC_TYPES.includes(t)
export const isOptionType = (t: CompanyFieldType) => t === 'select' || t === 'multi_select'

const MAX_TEXT = 2000
const MAX_LONG_TEXT = 20000
const MAX_OPTIONS = 100
const MAX_OPTION_LEN = 100

/** Thrown for a value or config a person (or Claude) can fix; the message says how. */
export class FieldValueError extends Error {}

/** Clean and check a field definition's config for its type. Unknown keys are dropped. */
export function normalizeFieldConfig(type: CompanyFieldType, raw: unknown): CompanyFieldConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: CompanyFieldConfig = {}
  if (isNumericType(type)) {
    if (c.decimals !== undefined && c.decimals !== null) {
      const d = Number(c.decimals)
      if (!Number.isInteger(d) || d < 0 || d > 6) throw new FieldValueError('Decimals must be a whole number from 0 to 6.')
      out.decimals = d
    }
    if (type === 'currency') {
      const unit = (c.unit ?? 'rupees') as string
      if (!['rupees', 'lakh', 'crore'].includes(unit)) throw new FieldValueError('Currency unit must be rupees, lakh or crore.')
      out.unit = unit as CurrencyUnit
    } else if (c.thousands !== undefined) {
      out.thousands = Boolean(c.thousands)
    }
  }
  if (isOptionType(type)) {
    const opts = Array.isArray(c.options) ? c.options : []
    const cleaned = Array.from(new Set(opts.map((o) => String(o).trim()).filter(Boolean)))
    if (cleaned.length === 0) throw new FieldValueError('A dropdown needs at least one option.')
    if (cleaned.length > MAX_OPTIONS) throw new FieldValueError(`A dropdown can have at most ${MAX_OPTIONS} options.`)
    if (cleaned.some((o) => o.length > MAX_OPTION_LEN)) throw new FieldValueError(`Each option must be at most ${MAX_OPTION_LEN} characters.`)
    out.options = cleaned
  }
  return out
}

/** Parse "12,34,567.5", "₹ 1.2 cr"-free plain numbers. Rejects anything that isn't a number. */
function parseNumber(input: string): number {
  const cleaned = input.replace(/[,\s₹%]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new FieldValueError(`"${input}" is not a number. Use digits only, e.g. 1500000.`)
  const n = Number(cleaned)
  if (!Number.isFinite(n)) throw new FieldValueError(`"${input}" is not a number.`)
  return n
}

/**
 * Turn whatever was entered into the stored TEXT value, or throw FieldValueError.
 * null / '' clears the field. Accepts string, number, boolean or string[] so the connector can pass
 * native JSON values; the UI passes strings.
 */
export function normalizeFieldValue(
  type: CompanyFieldType,
  config: CompanyFieldConfig | null | undefined,
  input: unknown,
): string | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'string' && input.trim() === '' && type !== 'checkbox') return null
  const cfg = config ?? {}

  switch (type) {
    case 'numeric':
    case 'percentage':
    case 'currency': {
      const n = typeof input === 'number' ? input : parseNumber(String(input))
      if (!Number.isFinite(n)) throw new FieldValueError('That is not a number.')
      if (type === 'currency' && n < 0) throw new FieldValueError('An amount in ₹ cannot be negative.')
      if (Math.abs(n) > 1e15) throw new FieldValueError('That number is too large.')
      return String(n)
    }
    case 'checkbox': {
      if (typeof input === 'boolean') return input ? 'true' : 'false'
      const s = String(input).trim().toLowerCase()
      if (['true', 'yes', '1', 'y'].includes(s)) return 'true'
      if (['false', 'no', '0', 'n', ''].includes(s)) return 'false'
      throw new FieldValueError('A checkbox is true or false.')
    }
    case 'date': {
      const s = String(input).trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
        throw new FieldValueError('Dates must be YYYY-MM-DD.')
      }
      return s
    }
    case 'url': {
      const s = String(input).trim()
      try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
        if (!u.hostname.includes('.')) throw new Error()
        return u.toString()
      } catch {
        throw new FieldValueError(`"${s}" is not a valid URL.`)
      }
    }
    case 'email': {
      const s = String(input).trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 254) throw new FieldValueError(`"${s}" is not a valid email address.`)
      return s
    }
    case 'phone': {
      const s = String(input).trim()
      const digits = s.replace(/\D/g, '')
      if (!/^\+?[\d\s()\-.]+$/.test(s) || digits.length < 7 || digits.length > 15) {
        throw new FieldValueError(`"${s}" is not a valid phone number.`)
      }
      return s
    }
    case 'select': {
      const s = String(input).trim()
      const match = (cfg.options ?? []).find((o) => o.toLowerCase() === s.toLowerCase())
      if (!match) throw new FieldValueError(`"${s}" is not one of the options: ${(cfg.options ?? []).join(', ')}.`)
      return match
    }
    case 'multi_select': {
      const list = Array.isArray(input) ? input.map(String)
        : typeof input === 'string' && input.trim().startsWith('[') ? safeJsonArray(input)
        : String(input).split(',')
      const picked: string[] = []
      for (const raw of list.map((x) => x.trim()).filter(Boolean)) {
        const match = (cfg.options ?? []).find((o) => o.toLowerCase() === raw.toLowerCase())
        if (!match) throw new FieldValueError(`"${raw}" is not one of the options: ${(cfg.options ?? []).join(', ')}.`)
        if (!picked.includes(match)) picked.push(match)
      }
      return picked.length ? JSON.stringify(picked) : null
    }
    case 'long_text': {
      const s = String(input).trim()
      if (s.length > MAX_LONG_TEXT) throw new FieldValueError(`Long text is limited to ${MAX_LONG_TEXT} characters.`)
      return s
    }
    case 'text':
    default: {
      const s = String(input).trim()
      if (s.length > MAX_TEXT) throw new FieldValueError(`Text is limited to ${MAX_TEXT} characters.`)
      return s
    }
  }
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/** The stored value as a native JSON value — what the connector returns. */
export function fieldValueToJson(type: CompanyFieldType, stored: string | null): unknown {
  if (stored === null || stored === '') return null
  if (isNumericType(type)) { const n = Number(stored); return Number.isFinite(n) ? n : stored }
  if (type === 'checkbox') return stored === 'true'
  if (type === 'multi_select') return safeJsonArray(stored)
  return stored
}

/** Multi-select stored value → its list, for the editor. */
export function multiSelectValues(stored: string | null): string[] {
  return stored ? safeJsonArray(stored) : []
}

/** Indian digit grouping: 1234567.5 → "12,34,567.5". */
function groupIndian(n: number, decimals: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** How a stored value is shown, Excel-style. Falls back to the raw text if it doesn't parse. */
export function formatFieldValue(type: CompanyFieldType, config: CompanyFieldConfig | null | undefined, stored: string | null): string {
  if (stored === null || stored === '') return ''
  const cfg = config ?? {}
  if (isNumericType(type)) {
    const n = Number(stored)
    if (!Number.isFinite(n)) return stored
    if (type === 'currency') {
      const unit = cfg.unit ?? 'rupees'
      const dec = cfg.decimals ?? (unit === 'rupees' ? 0 : 2)
      if (unit === 'lakh') return `₹${groupIndian(n / 1e5, dec)} L`
      if (unit === 'crore') return `₹${groupIndian(n / 1e7, dec)} Cr`
      return `₹${groupIndian(n, dec)}`
    }
    const dec = cfg.decimals ?? (Number.isInteger(n) ? 0 : 2)
    const body = cfg.thousands === false
      ? n.toFixed(dec)
      : groupIndian(n, dec)
    return type === 'percentage' ? `${body}%` : body
  }
  if (type === 'checkbox') return stored === 'true' ? 'Yes' : 'No'
  if (type === 'multi_select') return multiSelectValues(stored).join(', ')
  if (type === 'date') {
    const d = new Date(`${stored}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? stored : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return stored
}
