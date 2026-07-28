'use client'

import styles from '../analytics.module.css'

/* Charts are hand-rolled SVG/CSS — this app has no charting library and shouldn't gain one for
   two bar charts (same approach as active-deals/_components/DealCharts.tsx).

   Palette note: the diverging pair is brand purple #745FFD (positive) ↔ destructive #C0392B
   (negative), NOT the conventional green/red. Green↔red measures ΔE 4.2 under deuteranopia —
   far below the ≥8 floor — so red-green viewers could not tell a gain from a loss. Purple↔red
   measures 31.5 (light) / 29.3 (dark) and clears every check in both themes. Sign is *also*
   carried by bar direction and a signed label, so colour is never the only cue. */

function fmtSigned(n: number) {
  const r = Math.round(n * 10) / 10
  return `${r > 0 ? '+' : ''}${r}`
}

/** Single-series magnitude bars. Identity comes from the row labels, so one hue throughout —
    a different colour per row would imply a distinction that isn't there. */
export function MagnitudeBars({ rows, emptyLabel = 'Nothing yet' }: {
  rows: Array<{ label: string; value: number }>
  emptyLabel?: string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const shown = rows.filter((r) => r.value > 0)
  if (shown.length === 0) return <div className={styles.chartEmpty}>{emptyLabel}</div>

  return (
    <div className={styles.barList}>
      {shown.map((r) => (
        <div key={r.label} className={styles.barRow}>
          <span className={styles.barLabel} title={r.label}>{r.label}</span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
            />
          </span>
          <span className={styles.barValue}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Diverging bars around a zero baseline — for score contributions, where sign is the point.
 * Direction (left/right of centre) and the signed value label both encode sign independently
 * of hue, so this reads correctly with any colour vision.
 */
export function ContributionBars({ items }: {
  items: Array<{ label: string; value: number }>
}) {
  const shown = items.filter((i) => i.value !== 0)
  if (shown.length === 0) return <div className={styles.chartEmpty}>No scored activity in this period</div>

  const max = Math.max(...shown.map((i) => Math.abs(i.value)), 1)

  return (
    <div className={styles.divList}>
      {shown.map((i) => {
        const pct = (Math.abs(i.value) / max) * 50 // half-width per arm
        const positive = i.value > 0
        return (
          <div key={i.label} className={styles.divRow}>
            <span className={styles.barLabel} title={i.label}>{i.label}</span>
            <span className={styles.divTrack}>
              <span className={styles.divAxis} aria-hidden="true" />
              <span
                className={`${styles.divFill} ${positive ? styles.divPos : styles.divNeg}`}
                style={positive
                  ? { left: '50%', width: `${Math.max(pct, 1)}%` }
                  : { right: '50%', width: `${Math.max(pct, 1)}%` }}
              />
            </span>
            <span className={`${styles.divValue} ${positive ? styles.divValuePos : styles.divValueNeg}`}>
              {fmtSigned(i.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Headline figure. Not a chart — a single number doesn't need a plot to be understood. */
export function ScoreTile({ label, value, sub, tone }: {
  label: string; value: string | number; sub?: string; tone?: 'pos' | 'neg'
}) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={`${styles.tileValue} ${tone === 'pos' ? styles.tonePos : tone === 'neg' ? styles.toneNeg : ''}`}>
        {value}
      </div>
      {sub && <div className={styles.tileSub}>{sub}</div>}
    </div>
  )
}
