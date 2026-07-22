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

export function weekRange(offset: number): { start: Date; end: Date; label: string } {
  const start = getMonday(new Date())
  start.setDate(start.getDate() + offset * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end, label: `${formatDay(start)} – ${formatDay(end)}` }
}
