// Calendar-week (Mon-Sun) helpers shared by the Weekly Update page and the Tasks
// "By Person" view, so both page through weeks the same way.
export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * YYYY-MM-DD from a Date's *calendar* parts.
 *
 * Deliberately not toISOString(): that converts to UTC first, so any date at local midnight east
 * of Greenwich comes back as the previous day — which would silently file a to-do into the wrong
 * work week. This is what `personal_todos.work_week_start` stores.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekRange(offset: number): { start: Date; end: Date; label: string; key: string } {
  const start = getMonday(new Date())
  start.setDate(start.getDate() + offset * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end, label: `${formatDay(start)} – ${formatDay(end)}`, key: toDateKey(start) }
}
