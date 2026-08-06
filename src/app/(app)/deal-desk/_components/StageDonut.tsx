'use client'

import { useState } from 'react'
import styles from './deal-desk.module.css'

/**
 * Deals by funding stage.
 *
 * Note this is the company's *funding* stage — MVP through Series A+ — not a pipeline stage. Deal
 * Desk has no Sourcing/Due Diligence/Term Sheet funnel; where a deal has got to in review is its
 * status, which the KPI strip and the table's Status column carry instead.
 *
 * Because the stages are ordered, the palette is a sequential lightness ramp rather than six
 * unrelated hues: adjacent stages stay distinguishable without depending on hue perception, and
 * the ordering is visible in the chart itself. The legend carries the count and share anyway, so
 * no value here is readable only by colour.
 */
const RAMP = ['#E4D3FE', '#CEAAFD', '#A98BFD', '#8B72FD', '#745FFD', '#4B3BC4', '#A39B95']

export default function StageDonut({
  data,
  onSelect,
  selected,
}: {
  data: Array<{ label: string; count: number }>
  onSelect?: (label: string | null) => void
  selected?: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const shown = data.filter((d) => d.count > 0)
  const total = shown.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return <div className={styles.chartEmpty}>No deals to break down yet.</div>
  }

  const R = 62
  const STROKE = 20
  const C = 2 * Math.PI * R
  // A hairline gap between segments so neighbouring shades stay separable where they meet, which
  // matters most for the lightest segment against a light page.
  const GAP = total > 1 ? 1.5 : 0
  // …but a stage with one deal out of a hundred is thinner than that gap, and subtracting it would
  // draw nothing at all — a real deal vanishing from the chart. Every non-zero count keeps a
  // visible arc; it borrows a pixel or two from its neighbour, which is the better trade.
  const MIN_ARC = 2.5

  let offset = 0
  const segments = shown.map((d, i) => {
    const len = (d.count / total) * C
    const drawn = Math.max(MIN_ARC, len - GAP)
    const seg = {
      ...d,
      colour: RAMP[Math.min(i, RAMP.length - 1)],
      dash: `${drawn} ${C - drawn}`,
      // Offsets stay on the true proportions, so the ring as a whole still reads accurately.
      offset: -offset,
      pct: Math.round((d.count / total) * 100),
    }
    offset += len
    return seg
  })

  const focus = hover ?? selected ?? null
  const focused = segments.find((s) => s.label === focus) ?? null

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutFigure}>
        <svg viewBox="0 0 160 160" className={styles.donutSvg} role="img" aria-label={`Deals by funding stage: ${shown.map((d) => `${d.label} ${d.count}`).join(', ')}.`}>
          <g transform="rotate(-90 80 80)">
            {segments.map((s) => (
              <circle
                key={s.label}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={s.colour}
                strokeWidth={focus === s.label ? STROKE + 4 : STROKE}
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                className={styles.donutSeg}
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(selected === s.label ? null : s.label)}
              />
            ))}
          </g>
          <text x="80" y="76" className={styles.donutValue} textAnchor="middle">
            {focused ? focused.count : total}
          </text>
          <text x="80" y="94" className={styles.donutLabel} textAnchor="middle">
            {focused ? focused.label : 'Total'}
          </text>
        </svg>
      </div>

      <ul className={styles.donutLegend}>
        {segments.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              className={`${styles.legendRow} ${selected === s.label ? styles.legendRowActive : ''}`}
              onMouseEnter={() => setHover(s.label)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(selected === s.label ? null : s.label)}
              aria-pressed={selected === s.label}
            >
              <span className={styles.legendDot} style={{ background: s.colour }} />
              <span className={styles.legendName}>{s.label}</span>
              <span className={styles.legendCount}>{s.count}</span>
              <span className={styles.legendPct}>({s.pct}%)</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
