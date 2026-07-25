'use client'

import type { ActiveDealInvestorStatus } from '@/lib/types'
import { ACTIVE_DEAL_INVESTOR_STATUSES, ACTIVE_DEAL_INVESTOR_STATUS_META } from '@/lib/types'
import styles from '../active-deals.module.css'

// ── Status gauge ──────────────────────────────────────────────────────────────
// A dome of ticks (like a speedometer), partitioned into the four investor statuses in
// funnel order, each zone's tick-count proportional to how many investors sit in it. Every
// investor has exactly one status, so the whole dome is coloured — not_started's slate reads
// as "not progressed yet". Tick-based (not SVG arc paths) to stay robust and match the
// reference's dashed look.

const TICKS = 40
const GEO = { w: 240, h: 138, cx: 120, cy: 124, rInner: 82, rOuter: 100 }

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: GEO.cx + r * Math.cos(a), y: GEO.cy + r * Math.sin(a) }
}

export function StatusGauge({ counts, total }: { counts: Record<ActiveDealInvestorStatus, number>; total: number }) {
  // Cumulative fraction thresholds per status, in funnel order.
  const thresholds: Array<{ status: ActiveDealInvestorStatus; upTo: number }> = []
  let acc = 0
  for (const s of ACTIVE_DEAL_INVESTOR_STATUSES) {
    acc += counts[s]
    thresholds.push({ status: s, upTo: total > 0 ? acc / total : 0 })
  }

  function tickColor(frac: number): string {
    if (total === 0) return 'var(--color-border)'
    const hit = thresholds.find((t) => frac <= t.upTo + 1e-9) ?? thresholds[thresholds.length - 1]
    return ACTIVE_DEAL_INVESTOR_STATUS_META[hit.status].color
  }

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const frac = (i + 0.5) / TICKS
    const angle = 180 + frac * 180 // dome: 180° (left) → 360° (right)
    const p1 = polar(angle, GEO.rInner)
    const p2 = polar(angle, GEO.rOuter)
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color: tickColor(frac) }
  })

  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeChart}>
        <svg viewBox={`0 0 ${GEO.w} ${GEO.h}`} className={styles.gaugeSvg} role="img" aria-label="Investor status gauge">
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} strokeWidth={5} strokeLinecap="round" />
          ))}
        </svg>
        <div className={styles.gaugeCenter}>
          <span className={styles.gaugeCenterValue}>{total}</span>
          <span className={styles.gaugeCenterLabel}>Investor{total === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className={styles.chartLegend}>
        {ACTIVE_DEAL_INVESTOR_STATUSES.map((s) => {
          const meta = ACTIVE_DEAL_INVESTOR_STATUS_META[s]
          return (
            <div key={s} className={styles.legendRow}>
              <span className={styles.legendDot} style={{ background: meta.color }} />
              <span className={styles.legendLabel}>{meta.label}</span>
              <span className={styles.legendVal}>{counts[s]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Status donut ──────────────────────────────────────────────────────────────
// Committed amount broken down by status — conic-gradient ring (same pattern as the
// companies DonutChart, kept self-contained here).

export type DonutSegment = { label: string; value: number; color: string; valueLabel: string }

export function StatusDonut({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: string; centerLabel: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const active = segments.filter((s) => s.value > 0)

  if (total <= 0) {
    return <div className={styles.chartEmpty}>Nothing committed yet.</div>
  }

  let acc = 0
  const stops = active
    .map((s) => {
      const start = (acc / total) * 360
      acc += s.value
      const end = (acc / total) * 360
      return `${s.color} ${start}deg ${end}deg`
    })
    .join(', ')

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutRing} style={{ background: `conic-gradient(${stops})` }}>
        <div className={styles.donutHole}>
          <span className={styles.donutValue}>{centerValue}</span>
          <span className={styles.donutLabel}>{centerLabel}</span>
        </div>
      </div>
      <div className={styles.chartLegend}>
        {active.map((s) => (
          <div key={s.label} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendVal}>{s.valueLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
