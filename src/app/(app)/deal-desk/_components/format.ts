// Display helpers for Deal Desk (INR in Indian units, dates, initials).
import type { DeskDeal, DeskValuationType } from '@/lib/types'

/** Compact INR: ₹4 Cr / ₹40 L / ₹90,000. Input is plain rupees. */
export function formatInr(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `₹${trim(value / 1_00_00_000)} Cr`
  if (abs >= 1_00_000) return `₹${trim(value / 1_00_000)} L`
  return `₹${value.toLocaleString('en-IN')}`
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString()
}

export function formatValuation(type: DeskValuationType | null, amount: number | null): string {
  if (type === 'TBD' || (type == null && amount == null)) return 'TBD'
  return formatInr(amount)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/** One-line revenue summary for the desktop table. */
export function revenueSummary(deal: DeskDeal): string {
  if (deal.revenue_status !== 'Yes') return deal.revenue_status ?? '—'
  const last = deal.revenue_data[deal.revenue_data.length - 1]
  if (!last) return 'Yes'
  return `${formatInr(last.amount)} / ${deal.revenue_period === 'Annual' ? 'yr' : 'mo'}`
}
