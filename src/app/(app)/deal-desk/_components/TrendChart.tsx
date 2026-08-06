'use client'

import { useId, useMemo, useState } from 'react'
import styles from './deal-desk.module.css'

/**
 * Deals on the desk over the trailing window — an area chart, hand-rolled in SVG because the app
 * has no charting library and is not gaining one for this.
 *
 * The series is the running total, not deals added per day: per-day counts on a desk this size are
 * mostly zeroes with the occasional spike, which reads as noise rather than as a trend.
 */
export default function TrendChart({
  points,
}: {
  points: Array<{ date: string; added: number; cumulative: number }>
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const W = 720
  const H = 200
  const PAD = { top: 16, right: 8, bottom: 26, left: 34 }

  const geometry = useMemo(() => {
    if (points.length === 0) return null
    const max = Math.max(...points.map((p) => p.cumulative), 1)
    // Round the axis up to something a person would choose, so gridlines land on whole numbers.
    const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : max <= 200 ? 25 : 100
    const top = Math.ceil(max / step) * step
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ')
    const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    return { x, y, line, area, ticks, top, innerH }
  }, [points])

  if (!geometry) return <div className={styles.chartEmpty}>Nothing on the desk yet.</div>

  const { x, y, line, area, ticks } = geometry
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  // Only a few date labels — one per point would overlap into an unreadable smear.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))
  const active = hover === null ? null : points[hover]

  return (
    <div className={styles.trendWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.trendSvg}
        role="img"
        aria-label={`Deals on the desk over the last ${points.length} days, ending at ${points[points.length - 1].cumulative}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={styles.trendGrid} />
            <text x={PAD.left - 8} y={y(v) + 3.5} className={styles.trendAxis} textAnchor="end">{v}</text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className={styles.trendLine} />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 8} className={styles.trendAxis} textAnchor="middle">
              {fmtDay(p.date)}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className={styles.trendCursor} />
        )}
        {hover !== null && <circle cx={x(hover)} cy={y(points[hover].cumulative)} r={4} className={styles.trendDot} />}

        {/* One full-height hit area per point: chasing a 4px dot with the mouse is not a hover target. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.date}`}
            x={i === 0 ? PAD.left : (x(i) + x(i - 1)) / 2}
            y={PAD.top}
            width={Math.max(1, (i === 0 || i === points.length - 1 ? 1 : 2) * ((W - PAD.left - PAD.right) / (points.length - 1)) / 2)}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {active && (
        <div className={styles.trendTip}>
          <strong>{active.cumulative}</strong> on the desk
          <span className={styles.trendTipMeta}>
            {fmtDay(active.date)}{active.added > 0 ? ` · +${active.added} added` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
