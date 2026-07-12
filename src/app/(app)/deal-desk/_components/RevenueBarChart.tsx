'use client'

import type { DeskRevenuePoint, DeskRevenuePeriod, DeskRevenueStatus } from '@/lib/types'
import { formatInrShort, revenueGrowth } from './format'
import styles from './deal-desk.module.css'

// Revenue block: labelled bar chart + computed growth badge when there's revenue;
// a single muted line otherwise. No chart library (CSS/flex bars).
export default function RevenueBarChart({
  status,
  points,
  period,
  showLabels = true,
}: {
  status: DeskRevenueStatus | null
  points: DeskRevenuePoint[]
  period: DeskRevenuePeriod | null
  showLabels?: boolean
}) {
  // Negligible / No / missing series → don't render an empty chart area.
  if (status !== 'Yes' || points.length === 0) {
    if (!status) return null
    return (
      <div className={styles.chart}>
        <div className={styles.chartLabel}>Revenue</div>
        <div className={styles.revenueMuted}>{status === 'Negligible' ? 'Negligible revenue' : 'No revenue yet'}</div>
      </div>
    )
  }

  const max = Math.max(...points.map((p) => p.amount), 1)
  const visible = points.slice(-8)
  const growth = revenueGrowth(points, period)

  return (
    <div className={styles.chart}>
      <div className={styles.chartHeader}>
        <span className={styles.chartLabel}>Revenue{period ? ` · ${period}` : ''}</span>
        {growth && (
          <span
            className={`${styles.growthBadge} ${growth.pct > 0 ? styles.growthUp : growth.pct < 0 ? styles.growthDown : styles.growthFlat}`}
          >
            {growth.pct > 0 ? '▲ ' : growth.pct < 0 ? '▼ ' : ''}{growth.label}
          </span>
        )}
      </div>
      <div className={styles.bars}>
        {visible.map((p, i) => (
          <div key={`${p.period}-${i}`} className={styles.barCol} title={`${p.period}: ${formatInrShort(p.amount)}`}>
            <div className={styles.barTrack}>
              {showLabels && <span className={styles.barValue}>{formatInrShort(p.amount)}</span>}
              <div className={styles.bar} style={{ height: `${Math.max((p.amount / max) * 90, 4)}%` }} />
            </div>
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
