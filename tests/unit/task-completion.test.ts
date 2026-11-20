import { describe, expect, it } from 'vitest'
import { resolveTaskCompletion, TaskCompletionError, todayInIndia } from '@/lib/task-completion'

// 20 Nov 2026, 10:00 IST
const NOW = new Date('2026-11-20T04:30:00Z')

describe('resolveTaskCompletion', () => {
  it('defaults to an open task', () => {
    expect(resolveTaskCompletion(undefined, undefined, NOW)).toEqual({ status: 'To Do', completed_at: null })
  })
  it("stamps now when logging finished work without a date", () => {
    expect(resolveTaskCompletion('Done', undefined, NOW)).toEqual({ status: 'Done', completed_at: NOW.toISOString() })
  })
  it('backdates to midday India time for a plain date, so it never slips a day', () => {
    const r = resolveTaskCompletion('Done', '2026-11-18', NOW)
    expect(r).toEqual({ status: 'Done', completed_at: '2026-11-18T06:30:00.000Z' })
  })
  it('implies Done when only completed_at is given', () => {
    expect(resolveTaskCompletion(null, '2026-11-01', NOW).status).toBe('Done')
  })
  it('accepts today and full ISO timestamps in the past', () => {
    expect(resolveTaskCompletion('Done', '2026-11-20', NOW).status).toBe('Done')
    expect(resolveTaskCompletion('Done', '2026-11-19T15:00:00+05:30', NOW).completed_at).toBe('2026-11-19T09:30:00.000Z')
  })
  it('rejects future dates', () => {
    expect(() => resolveTaskCompletion('Done', '2026-11-21', NOW)).toThrow(/future/)
    expect(() => resolveTaskCompletion('Done', '2026-11-20T12:00:00+05:30', NOW)).toThrow(/future/)
  })
  it('rejects contradictions and junk', () => {
    expect(() => resolveTaskCompletion('To Do', '2026-11-01', NOW)).toThrow(TaskCompletionError)
    expect(() => resolveTaskCompletion('Doing', undefined, NOW)).toThrow(/status/)
    expect(() => resolveTaskCompletion('Done', 'yesterday', NOW)).toThrow(TaskCompletionError)
    expect(() => resolveTaskCompletion('Done', '2026-02-30', NOW)).toThrow(/real date/)
  })
})

describe('todayInIndia', () => {
  it('uses India time, not UTC', () => {
    // 23:00 UTC on the 19th is already the 20th in India.
    expect(todayInIndia(new Date('2026-11-19T23:00:00Z'))).toBe('2026-11-20')
  })
})
