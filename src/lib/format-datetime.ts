/* Shared date/time formatting for user-facing timestamps.

   Pinned to Asia/Kolkata rather than the viewer's local zone, matching the convention already
   set by the HR clock widget (src/app/_components/HrClockWidget.tsx). Without pinning, two
   colleagues in different timezones would see different "assigned at" times for the same event,
   which makes the timestamp useless for coordinating. India has no DST, so there are no seasonal
   edge cases. */

const IST = 'Asia/Kolkata'

/** e.g. "15 Jul, 4:48 pm" — no year, for recent activity. */
export function formatDateTimeIst(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

/** e.g. "15 Jul 2026, 4:48 pm IST" — fully explicit, for tooltips and detail views. */
export function formatDateTimeIstLong(iso: string): string {
  const s = new Date(iso).toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return `${s} IST`
}
