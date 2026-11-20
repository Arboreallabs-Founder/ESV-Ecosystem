import { describe, expect, it } from 'vitest'
import { istRange, mondayOf, DateRangeError } from '@/lib/date-range'

describe('mondayOf', () => {
  it('finds the Monday of the week, treating Sunday as the end of the week', () => {
    expect(mondayOf('2026-11-20')).toBe('2026-11-16') // Friday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16') // Monday
    expect(mondayOf('2026-11-22')).toBe('2026-11-16') // Sunday
  })
})

describe('istRange', () => {
  // Friday 20 Nov 2026, 10:00 IST
  const NOW = new Date('2026-11-20T04:30:00Z')

  it('defaults to this week so far, in India time', () => {
    const r = istRange(undefined, undefined, NOW)
    expect(r).toMatchObject({ from: '2026-11-16', to: '2026-11-20' })
    expect(r.startIso).toBe('2026-11-15T18:30:00.000Z') // Mon 00:00 IST
    expect(r.endIso).toBe('2026-11-20T18:30:00.000Z')   // Sat 00:00 IST
  })
  it('uses India time near midnight', () => {
    // 19:00 UTC Sunday = 00:30 IST Monday: a new week has started.
    expect(istRange(undefined, undefined, new Date('2026-11-22T19:00:00Z')).from).toBe('2026-11-23')
  })
  it('accepts an explicit inclusive range', () => {
    const r = istRange('2026-11-01', '2026-11-07', NOW)
    expect(r.endIso).toBe('2026-11-07T18:30:00.000Z')
  })
  it('rejects bad, reversed and very long ranges', () => {
    expect(() => istRange('01-11-2026', undefined, NOW)).toThrow(DateRangeError)
    expect(() => istRange('2026-11-10', '2026-11-01', NOW)).toThrow(/after/)
    expect(() => istRange('2026-01-01', '2026-11-01', NOW)).toThrow(/three months/)
  })
})
