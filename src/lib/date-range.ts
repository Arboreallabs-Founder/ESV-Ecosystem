import { todayInIndia } from '@/lib/task-completion'

/**
 * Date ranges in India time, for "what did X do this week" questions.
 *
 * Days are whole IST days: a range [from, to] runs from `from` 00:00 IST up to the end of `to`
 * (exclusive start of the next day), so a task completed at 23:30 IST on Friday counts as Friday.
 */

export type IstRange = { from: string; to: string; startIso: string; endIso: string }

export class DateRangeError extends Error {}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Monday of the IST week containing `date` (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow)
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Resolve an optional from/to (YYYY-MM-DD, inclusive) to a range; default this week so far. */
export function istRange(from?: string | null, to?: string | null, now = new Date()): IstRange {
  const today = todayInIndia(now)
  const f = from ?? mondayOf(today)
  const t = to ?? today
  for (const [k, v] of [['from', f], ['to', t]] as const) {
    if (!DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new DateRangeError(`${k} must be a date, YYYY-MM-DD.`)
  }
  if (f > t) throw new DateRangeError('from is after to.')
  const days = (Date.parse(`${t}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / 86_400_000
  if (days > 92) throw new DateRangeError('Ask for at most about three months at a time.')
  return {
    from: f,
    to: t,
    startIso: new Date(`${f}T00:00:00+05:30`).toISOString(),
    endIso: new Date(`${addDays(t, 1)}T00:00:00+05:30`).toISOString(),
  }
}
