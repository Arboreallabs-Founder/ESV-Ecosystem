/* IST calendar dates.
 *
 * Everyone on this app works in IST, so "today" must mean today in Kolkata regardless of where
 * the server runs (Vercel is UTC) or what a browser's clock says. Returns 'YYYY-MM-DD', matching
 * a Postgres DATE.
 *
 * Lives in lib rather than beside the day-plan action because a 'use server' module may only
 * export async functions, and this is a pure one that both the action and the page need.
 */

const IST_OFFSET_MINUTES = 330

export function istDate(offsetDays = 0, now: Date = new Date()): string {
  const ist = new Date(now.getTime() + (IST_OFFSET_MINUTES + now.getTimezoneOffset()) * 60_000)
  ist.setDate(ist.getDate() + offsetDays)
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`
}

export function todayIst(now?: Date): string { return istDate(0, now) }
export function tomorrowIst(now?: Date): string { return istDate(1, now) }
