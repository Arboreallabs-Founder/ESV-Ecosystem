/* Day/month birthdays for investors and partner contacts.

   Stored as 'MM-DD' so it sorts naturally and matches on the same slice the hr_birthdays
   lookup uses (src/lib/hr-clock.ts). Entered and displayed as 'DD/MM', which is what people
   actually write in India. The year is deliberately absent: it's usually unknown, and a DATE
   column with an invented year would leak that fiction into sorting and display. */

/** 'MM-DD' → 'DD/MM' for display/inputs. Returns '' for null/invalid. */
export function mdToDisplay(md: string | null | undefined): string {
  if (!md) return ''
  const m = /^(\d{2})-(\d{2})$/.exec(md)
  return m ? `${m[2]}/${m[1]}` : ''
}

/** 'DD/MM' (or 'DD-MM') → 'MM-DD' for storage. Returns null if blank or not a real day/month. */
export function displayToMd(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null
  const m = /^(\d{1,2})[/-](\d{1,2})$/.exec(input.trim())
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible day/month pairs (e.g. 31/02) rather than storing something the DB
  // CHECK would accept but a calendar wouldn't.
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (day > maxDay) return null
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** True if the stored 'MM-DD' matches the given IST month/day (defaults to today). */
export function isBirthdayToday(md: string | null | undefined, todayMd?: string): boolean {
  if (!md) return false
  const today = todayMd ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit',
  }).format(new Date()).slice(-5)
  return md === today
}
