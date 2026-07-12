// Display helpers for Deal Desk (INR in Indian units, dates, initials).
import type { DeskDeal, DeskRevenuePeriod, DeskRevenuePoint, DeskValuationType } from '@/lib/types'

/** Compact INR: ₹4 Cr / ₹40 L / ₹90,000. Input is plain rupees. */
export function formatInr(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `₹${trim(value / 1_00_00_000)} Cr`
  if (abs >= 1_00_000) return `₹${trim(value / 1_00_000)} L`
  return `₹${value.toLocaleString('en-IN')}`
}

/** Ultra-compact INR without the symbol, for tight spots like bar-top labels: 21L, 1.8L, 80Cr, 9.5k. */
export function formatInrShort(value: number | null | undefined): string {
  if (value == null) return ''
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${trim(value / 1_00_00_000)}Cr`
  if (abs >= 1_00_000) return `${trim(value / 1_00_000)}L`
  if (abs >= 1_000) return `${trim(value / 1_000)}k`
  return `${value}`
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString()
}

/** Period-over-period growth from the last two revenue points, computed (never stored). */
export type RevenueGrowth = { pct: number; label: string }
export function revenueGrowth(points: DeskRevenuePoint[], period: DeskRevenuePeriod | null): RevenueGrowth | null {
  if (points.length < 2) return null
  const prev = points[points.length - 2].amount
  const last = points[points.length - 1].amount
  if (prev === 0) return null
  const pct = ((last - prev) / Math.abs(prev)) * 100
  const suffix = period === 'Annual' ? 'YoY' : 'MoM'
  return { pct, label: `${pct > 0 ? '+' : ''}${Math.round(pct)}% ${suffix}` }
}

// Sector → badge colour (translucent bg reads on both light & dark). Keyword-matched so free-text
// variants ("Deep Tech", "deep-tech") still map; unknown sectors fall back to the default purple pill.
const SECTOR_COLORS: Array<{ test: RegExp; bg: string; fg: string }> = [
  { test: /deep|ai|robot/, bg: 'rgba(47,111,237,0.15)', fg: '#2F6FED' },       // Deep tech — blue
  { test: /climate|sustain|clean|energy/, bg: 'rgba(46,158,91,0.16)', fg: '#2E9E5B' }, // Climate — green
  { test: /health|femtech|med|bio|pharma/, bg: 'rgba(116,95,253,0.15)', fg: '#7C5CFC' }, // Health — purple
  { test: /consumer|d2c|retail|food/, bg: 'rgba(208,138,30,0.18)', fg: '#B9791A' },  // Consumer — amber
  { test: /fintech|financ|payment|bank/, bg: 'rgba(14,154,167,0.16)', fg: '#0E9AA7' }, // Fintech — teal
  { test: /saas|software|b2b/, bg: 'rgba(84,87,214,0.16)', fg: '#5457D6' },     // SaaS — indigo
  { test: /agri|farm/, bg: 'rgba(122,139,42,0.18)', fg: '#6E7D26' },            // Agritech — olive
]

/** Inline colour style for a sector badge, or null to use the default `.badgeSector` pill. */
export function sectorBadge(sector: string | null | undefined): { background: string; color: string } | null {
  if (!sector) return null
  const s = sector.toLowerCase()
  const match = SECTOR_COLORS.find((c) => c.test.test(s))
  return match ? { background: match.bg, color: match.fg } : null
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

// ── Tier-1 computed signals (no stored fields) ───────────────────────────────

/** Annualised run-rate from the latest revenue point (monthly ×12, annual as-is). */
export function arrRunRate(deal: DeskDeal): number | null {
  if (deal.revenue_status !== 'Yes') return null
  const last = deal.revenue_data[deal.revenue_data.length - 1]
  if (!last) return null
  return deal.revenue_period === 'Annual' ? last.amount : last.amount * 12
}

/** Valuation ÷ ARR (only when a Fixed valuation and revenue exist). e.g. 8 → "8× ARR". */
export function valuationMultiple(deal: DeskDeal): number | null {
  const arr = arrRunRate(deal)
  if (!arr || arr <= 0) return null
  if (deal.valuation_type !== 'Fixed' || deal.valuation_inr == null) return null
  return deal.valuation_inr / arr
}

/**
 * Sanity check: valuation implied by ask ÷ dilution vs. the stated valuation.
 * Returns the two figures + the % gap; callers flag when the gap is large.
 */
export function valuationSanity(deal: DeskDeal): { implied: number; stated: number; gapPct: number } | null {
  if (deal.ask_inr == null || deal.dilution_percent == null || deal.dilution_percent <= 0) return null
  if (deal.valuation_type !== 'Fixed' || deal.valuation_inr == null || deal.valuation_inr <= 0) return null
  const implied = deal.ask_inr / (deal.dilution_percent / 100)
  const stated = deal.valuation_inr
  return { implied, stated, gapPct: (Math.abs(implied - stated) / stated) * 100 }
}

/** Round funding progress from committed vs ask. */
export function roundProgress(deal: DeskDeal): { committed: number; ask: number; pct: number } | null {
  if (deal.ask_inr == null || deal.ask_inr <= 0 || deal.committed_inr == null) return null
  return { committed: deal.committed_inr, ask: deal.ask_inr, pct: Math.min((deal.committed_inr / deal.ask_inr) * 100, 100) }
}

/** Days since the first-level call. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** Human freshness: "Called today" / "Called 3d ago" / "Called 6w ago". */
export function freshnessLabel(iso: string | null | undefined): string | null {
  const d = daysSince(iso)
  if (d == null) return null
  if (d === 0) return 'Called today'
  if (d < 14) return `Called ${d}d ago`
  if (d < 60) return `Called ${Math.round(d / 7)}w ago`
  return `Called ${Math.round(d / 30)}mo ago`
}
/** True when the call is old enough to warrant a muted/stale treatment. */
export function isStale(iso: string | null | undefined): boolean {
  const d = daysSince(iso)
  return d != null && d >= 30
}

// Key fields we expect a complete card to carry; drives the completeness meter.
const COMPLETENESS_FIELDS: Array<{ label: string; has: (d: DeskDeal) => boolean }> = [
  { label: 'Ask', has: (d) => d.ask_inr != null },
  { label: 'Valuation', has: (d) => d.valuation_type === 'TBD' || d.valuation_inr != null },
  { label: 'Revenue', has: (d) => d.revenue_status != null },
  { label: 'Founders', has: (d) => d.founders.length > 0 },
  { label: 'Deck', has: (d) => !!d.pitch_deck_url },
  { label: 'Runway', has: (d) => d.runway_months != null },
  { label: 'Margin', has: (d) => d.gross_margin_pct != null },
]

/** How much of the key investor data is present. */
export function completeness(deal: DeskDeal): { filled: number; total: number; missing: string[] } {
  const missing = COMPLETENESS_FIELDS.filter((f) => !f.has(deal)).map((f) => f.label)
  return { filled: COMPLETENESS_FIELDS.length - missing.length, total: COMPLETENESS_FIELDS.length, missing }
}
