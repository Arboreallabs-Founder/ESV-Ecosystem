// Display helpers for Company profiles (INR in Indian units, dates).
export function formatInr(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `₹${trim(value / 1_00_00_000)} Cr`
  if (abs >= 1_00_000) return `₹${trim(value / 1_00_000)} L`
  return `₹${value.toLocaleString('en-IN')}`
}
function trim(n: number): string { return Number(n.toFixed(2)).toString() }

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export function locationLabel(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(', ') || '—'
}
