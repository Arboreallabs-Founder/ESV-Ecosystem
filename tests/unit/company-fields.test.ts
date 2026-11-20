import { describe, expect, it } from 'vitest'
import { normalizeFieldValue, normalizeFieldConfig, formatFieldValue, fieldValueToJson, FieldValueError } from '@/lib/company-fields'

describe('normalizeFieldValue', () => {
  it('stores numbers raw, accepting grouped and ₹-prefixed input', () => {
    expect(normalizeFieldValue('currency', {}, '₹12,34,567')).toBe('1234567')
    expect(normalizeFieldValue('numeric', {}, 1500.5)).toBe('1500.5')
    expect(normalizeFieldValue('percentage', {}, '18.5%')).toBe('18.5')
  })
  it('rejects non-numbers and negative rupee amounts', () => {
    expect(() => normalizeFieldValue('numeric', {}, '12 lakh')).toThrow(FieldValueError)
    expect(() => normalizeFieldValue('currency', {}, -5)).toThrow(/negative/)
  })
  it('clears on null or empty', () => {
    expect(normalizeFieldValue('text', {}, null)).toBeNull()
    expect(normalizeFieldValue('currency', {}, '  ')).toBeNull()
  })
  it('handles checkboxes from booleans and words', () => {
    expect(normalizeFieldValue('checkbox', {}, true)).toBe('true')
    expect(normalizeFieldValue('checkbox', {}, 'no')).toBe('false')
    expect(() => normalizeFieldValue('checkbox', {}, 'maybe')).toThrow(FieldValueError)
  })
  it('validates dates, emails, phones and URLs', () => {
    expect(normalizeFieldValue('date', {}, '2026-02-28')).toBe('2026-02-28')
    expect(() => normalizeFieldValue('date', {}, '28/02/2026')).toThrow(/YYYY-MM-DD/)
    expect(normalizeFieldValue('email', {}, 'Founder@Acme.in ')).toBe('founder@acme.in')
    expect(() => normalizeFieldValue('email', {}, 'not-an-email')).toThrow(FieldValueError)
    expect(normalizeFieldValue('phone', {}, '+91 98765 43210')).toBe('+91 98765 43210')
    expect(() => normalizeFieldValue('phone', {}, '12')).toThrow(FieldValueError)
    expect(normalizeFieldValue('url', {}, 'acme.in')).toBe('https://acme.in/')
    expect(() => normalizeFieldValue('url', {}, 'nonsense')).toThrow(FieldValueError)
  })
  it('matches dropdown options case-insensitively and stores the canonical option', () => {
    const cfg = { options: ['Seed', 'Series A'] }
    expect(normalizeFieldValue('select', cfg, 'seed')).toBe('Seed')
    expect(() => normalizeFieldValue('select', cfg, 'Series Z')).toThrow(/not one of the options/)
    expect(normalizeFieldValue('multi_select', cfg, ['series a', 'Seed', 'Seed'])).toBe('["Series A","Seed"]')
    expect(normalizeFieldValue('multi_select', cfg, 'Seed, Series A')).toBe('["Seed","Series A"]')
    expect(normalizeFieldValue('multi_select', cfg, [])).toBeNull()
  })
  it('limits text length', () => {
    expect(() => normalizeFieldValue('text', {}, 'x'.repeat(2001))).toThrow(/2000/)
    expect(normalizeFieldValue('long_text', {}, 'x'.repeat(5000))).toHaveLength(5000)
  })
})

describe('normalizeFieldConfig', () => {
  it('keeps only the settings that apply to the type', () => {
    expect(normalizeFieldConfig('currency', { unit: 'lakh', decimals: 2, options: ['x'] })).toEqual({ unit: 'lakh', decimals: 2 })
    expect(normalizeFieldConfig('numeric', { thousands: false })).toEqual({ thousands: false })
    expect(normalizeFieldConfig('text', { decimals: 3 })).toEqual({})
  })
  it('requires options for dropdowns and dedupes them', () => {
    expect(() => normalizeFieldConfig('select', { options: [' ', ''] })).toThrow(/at least one option/)
    expect(normalizeFieldConfig('multi_select', { options: ['A', 'A', ' B '] })).toEqual({ options: ['A', 'B'] })
  })
  it('rejects bad decimals and units', () => {
    expect(() => normalizeFieldConfig('numeric', { decimals: 9 })).toThrow(FieldValueError)
    expect(() => normalizeFieldConfig('currency', { unit: 'million' })).toThrow(FieldValueError)
  })
})

describe('formatFieldValue', () => {
  it('formats rupees with Indian grouping, lakh and crore', () => {
    expect(formatFieldValue('currency', {}, '1234567')).toBe('₹12,34,567')
    expect(formatFieldValue('currency', { unit: 'lakh' }, '1234567')).toBe('₹12.35 L')
    expect(formatFieldValue('currency', { unit: 'crore', decimals: 1 }, '125000000')).toBe('₹12.5 Cr')
  })
  it('formats numbers and percentages per config', () => {
    expect(formatFieldValue('numeric', { decimals: 2 }, '1234567')).toBe('12,34,567.00')
    expect(formatFieldValue('numeric', { thousands: false, decimals: 0 }, '1234567')).toBe('1234567')
    expect(formatFieldValue('percentage', {}, '18.5')).toBe('18.50%')
  })
  it('formats checkboxes, multi-selects and dates', () => {
    expect(formatFieldValue('checkbox', {}, 'true')).toBe('Yes')
    expect(formatFieldValue('multi_select', {}, '["A","B"]')).toBe('A, B')
    expect(formatFieldValue('date', {}, '2026-02-28')).toBe('28 Feb 2026')
  })
  it('returns the raw text when a stored value does not parse', () => {
    expect(formatFieldValue('numeric', {}, 'legacy text')).toBe('legacy text')
  })
})

describe('fieldValueToJson', () => {
  it('returns native values for the connector', () => {
    expect(fieldValueToJson('currency', '2500000')).toBe(2500000)
    expect(fieldValueToJson('checkbox', 'false')).toBe(false)
    expect(fieldValueToJson('multi_select', '["A"]')).toEqual(['A'])
    expect(fieldValueToJson('text', null)).toBeNull()
  })
})
