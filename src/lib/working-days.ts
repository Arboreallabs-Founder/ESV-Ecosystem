/* Working days — the one place that decides whether a date costs someone leave.
 *
 * Two rules, both from the Attendance and Leave policies:
 *   - Sunday is the weekly off (Monday to Saturday are working days, so Saturday IS chargeable).
 *   - A holiday is a day off. Holidays are rows in `holidays`; Sundays are not, because the
 *     weekly off is a rule rather than a calendar entry.
 *
 * Deliberately pure and synchronous: the caller fetches the holiday set once and passes it in.
 * A helper that went to the database per request would be called in a loop over every approved
 * leave row on the Balances tab.
 *
 * Dates are 'YYYY-MM-DD' throughout, matching Postgres DATE. They are parsed with an explicit
 * T00:00:00 so the runtime's timezone cannot shift a date across a day boundary — the same
 * convention lib/attendance.ts already uses.
 */

export type HolidaySet = ReadonlySet<string>

/** Sunday only. Saturday is a working day at ESV — see the Attendance policy, §4. */
export function isWeeklyOff(date: string): boolean {
  return new Date(`${date}T00:00:00`).getDay() === 0
}

/** A day nobody is expected to work: the weekly off, or a holiday. */
export function isNonWorkingDay(date: string, holidays: HolidaySet): boolean {
  return isWeeklyOff(date) || holidays.has(date)
}

/** Every date from start to end inclusive, as 'YYYY-MM-DD'. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (d <= last) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Days a leave request actually costs: working days in the range, ignoring Sundays and holidays.
 *
 * A half day is 0.5 — but only if that single day is itself a working day. Flagging a half day on
 * a Sunday should cost nothing rather than half a day.
 */
export function workingDays(start: string, end: string, holidays: HolidaySet, isHalfDay = false): number {
  if (isHalfDay) return isNonWorkingDay(start, holidays) ? 0 : 0.5
  let count = 0
  for (const day of eachDate(start, end)) {
    if (!isNonWorkingDay(day, holidays)) count++
  }
  return count
}

/** The non-working days inside a range — what the leave form shows as "excluding…". */
export function nonWorkingDaysIn(start: string, end: string, holidays: HolidaySet): string[] {
  return eachDate(start, end).filter((d) => isNonWorkingDay(d, holidays))
}
