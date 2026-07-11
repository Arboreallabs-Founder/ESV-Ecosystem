'use client'

import type { DeskRevenuePoint } from '@/lib/types'
import { formatInr } from './format'
import styles from './deal-desk.module.css'

// Tiny CSS/flex bar chart — no chart library (matches the app's no-dense-libs rule).
export default function RevenueBarChart({
  points,
  period,
  showLabels = true,
}: {
  points: DeskRevenuePoint[]
  period: string | null
  showLabels?: boolean
}) {
  if (points.length === 0) return null
  const max = Math.max(...points.map((p) => p.amount), 1)
  // Cap visible bars so the card stays scannable; keep the most recent.
  const visible = points.slice(-8)

  return (
    <div className={styles.chart}>
      <div className={styles.chartLabel}>Revenue{period ? ` · ${period}` : ''}</div>
      <div className={styles.bars}>
        {visible.map((p, i) => (
          <div key={`${p.period}-${i}`} className={styles.barCol} title={`${p.period}: ${formatInr(p.amount)}`}>
            <div className={styles.bar} style={{ height: `${Math.max((p.amount / max) * 100, 4)}%` }} />
            {showLabels && <span className={styles.barTick}>{shortPeriod(p.period)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// "2026-01" → "Jan"; "2026" → "'26"; else the raw string.
function shortPeriod(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]
    return month ?? period
  }
  if (/^\d{4}$/.test(period)) return `'${period.slice(2)}`
  return period
}
