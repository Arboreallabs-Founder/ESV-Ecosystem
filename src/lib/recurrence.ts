// Pure date math for recurring tasks — no DB/framework deps, so it's the same on server and client.
import type { RecurrenceType, RecurringTaskStatus } from './types'

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function todayDateOnly(): string {
  return formatDateOnly(new Date())
}

/** Advance a YYYY-MM-DD date by one recurrence interval. Monthly clamps to the target month's last day. */
export function addRecurrenceInterval(dateStr: string, type: RecurrenceType): string {
  const d = parseDateOnly(dateStr)
  if (type === 'daily') {
    d.setUTCDate(d.getUTCDate() + 1)
  } else if (type === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7)
  } else {
    const day = d.getUTCDate()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + 1)
    const lastDayOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(day, lastDayOfMonth))
  }
  return formatDateOnly(d)
}

/** Calendar days from today to the given date (negative if it's in the past). */
export function daysUntil(dateStr: string, todayStr: string = todayDateOnly()): number {
  return Math.round((parseDateOnly(dateStr).getTime() - parseDateOnly(todayStr).getTime()) / 86400000)
}

/**
 * hidden — more than `leadDays` away, not shown yet.
 * upcoming — within the lead window, due today or in the future.
 * overdue — due date has passed and it's still not been ticked off (stays this way indefinitely
 * until completed — the next occurrence is never generated for a missed one).
 */
export function computeRecurringStatus(nextDueDate: string, leadDays: number, todayStr: string = todayDateOnly()): RecurringTaskStatus {
  const diff = daysUntil(nextDueDate, todayStr)
  if (diff < 0) return 'overdue'
  if (diff <= leadDays) return 'upcoming'
  return 'hidden'
}
