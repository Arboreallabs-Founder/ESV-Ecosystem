/* Birthdays for investors and partner contacts.

   The day/month is stored as 'MM-DD' so it sorts naturally and matches on the same slice the
   hr_birthdays lookup uses (src/lib/hr-clock.ts). The year is a *separate optional* column: for
   most people here it genuinely isn't known, and folding both into a DATE would force an invented
   year that then leaks into sorting, display and age maths. Entered and displayed as 'DD/MM' or
   'DD/MM/YYYY', which is what people actually write in India. */

/** Lower bound matches the DB CHECK; the upper bound is "not in the future", applied per-call. */
const MIN_YEAR = 1900

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 'MM-DD' (+ optional year) → 'DD/MM' or 'DD/MM/YYYY'. Returns '' for null/invalid. */
export function mdToDisplay(md: string | null | undefined, year?: number | null): string {
  if (!md) return ''
  const m = /^(\d{2})-(\d{2})$/.exec(md)
  if (!m) return ''
  const dayMonth = `${m[2]}/${m[1]}`
  return year ? `${dayMonth}/${year}` : dayMonth
}

export type BirthdayParts = { md: string | null; year: number | null }

/**
 * 'DD/MM' or 'DD/MM/YYYY' (either separator) → storable parts.
 *
 * Returns `{ md: null, year: null }` for blank or unparseable input, so a typo clears the field
 * rather than silently storing something wrong. A year is only kept when the day/month parses.
 */
export function parseBirthday(input: string | null | undefined, now: Date = new Date()): BirthdayParts {
  const empty: BirthdayParts = { md: null, year: null }
  if (!input || !input.trim()) return empty

  const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(input.trim())
  if (!m) return empty

  const day = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12 || day < 1) return empty

  // Reject impossible day/month pairs (e.g. 31/02) rather than storing something the DB CHECK
  // would accept but a calendar wouldn't.
  if (day > DAYS_IN_MONTH[month - 1]) return empty

  const md = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (m[3] === undefined) return { md, year: null }

  const year = Number(m[3])
  // A future birth year, or one before the DB's floor, is a typo — keep the day/month and drop
  // just the year rather than rejecting the whole entry over the part we're least sure about.
  if (year < MIN_YEAR || year > now.getFullYear()) return { md, year: null }
  // 29 February only exists in a leap year; with a year given we can actually check.
  if (month === 2 && day === 29 && !isLeapYear(year)) return { md, year: null }

  return { md, year }
}

/**
 * Back-compat shim for callers that only need the day/month.
 * @deprecated Prefer `parseBirthday` so the year isn't silently dropped.
 */
export function displayToMd(input: string | null | undefined): string | null {
  return parseBirthday(input).md
}

/** True if the stored 'MM-DD' matches the given IST month/day (defaults to today). */
export function isBirthdayToday(md: string | null | undefined, todayMd?: string): boolean {
  if (!md) return false
  const today = todayMd ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit',
  }).format(new Date()).slice(-5)
  return md === today
}

/**
 * Age in whole years, or null when the birth year is unknown.
 * Counts a birthday as reached on the day itself, in IST — same timezone convention as the rest
 * of the app (see src/lib/task-kpi.ts) so two colleagues never disagree about someone's age.
 */
export function ageFrom(md: string | null | undefined, year: number | null | undefined): number | null {
  if (!md || !year) return null
  const m = /^(\d{2})-(\d{2})$/.exec(md)
  if (!m) return null

  const todayIst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [ty, tm, td] = todayIst.split('-').map(Number)

  let age = ty - year
  // Birthday not reached yet this year.
  if (tm < Number(m[1]) || (tm === Number(m[1]) && td < Number(m[2]))) age--
  return age >= 0 ? age : null
}
