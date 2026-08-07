/**
 * Attendance helpers with no server dependencies.
 *
 * Deliberately separate from src/lib/attendance.ts, which imports the server Supabase client and
 * therefore next/headers. Client components need the formatting and the totals, and importing them
 * from the server module pulls next/headers into the browser bundle — a build failure that
 * typechecking does not catch.
 */
import type { AttendanceLine } from '@/lib/types'

/** First of the month, in IST — the boundary everyone here actually works to. */
export function monthKey(d: Date = new Date()): string {
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-01`
}

export function monthLabel(period: string): string {
  return new Date(`${period}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** Last N months, newest first, as period keys. */
export function recentMonths(n = 12): string[] {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ist.getFullYear(), ist.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
}

/**
 * Chargeable leave for a statement. Waived lines still show — the record of what happened is the
 * point — but they do not add to the total, which is what "considered" means on the sheet.
 */
export function totalLeaveDays(lines: AttendanceLine[]): number {
  const total = lines.reduce((sum, l) => sum + (l.waived ? 0 : Number(l.leave_days) || 0), 0)
  return Math.round(total * 100) / 100
}

export function countByType(lines: AttendanceLine[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lines) out[l.line_type] = (out[l.line_type] ?? 0) + 1
  return out
}
