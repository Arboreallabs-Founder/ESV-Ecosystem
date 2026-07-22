import styles from '../companies.module.css'

export type DonutSegment = { label: string; value: number; color: string; valueLabel: string }

// Pure-CSS donut (conic-gradient ring + a punched-out center circle) — no charting library.
export default function DonutChart({ segments, centerLabel, centerValue }: {
  segments: DonutSegment[]
  centerLabel?: string
  centerValue?: string
}) {
  const shown = segments.filter((s) => s.value > 0)
  const total = shown.reduce((sum, s) => sum + s.value, 0)

  if (shown.length === 0 || total <= 0) {
    return <div className={styles.muted}>Nothing to chart yet.</div>
  }

  const stops = shown.reduce<{ ranges: string[]; cumulative: number }>((state, s) => {
    const start = (state.cumulative / total) * 100
    const cumulative = state.cumulative + s.value
    const end = (cumulative / total) * 100
    return { ranges: [...state.ranges, `${s.color} ${start}% ${end}%`], cumulative }
  }, { ranges: [], cumulative: 0 }).ranges

  return (
    <div className={styles.donutRow}>
      <div className={styles.donut} style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className={styles.donutHole}>
          {centerValue && <div className={styles.donutCenterValue}>{centerValue}</div>}
          {centerLabel && <div className={styles.donutCenterLabel}>{centerLabel}</div>}
        </div>
      </div>
      <div className={styles.donutLegend}>
        {shown.map((s) => (
          <div key={s.label} className={styles.legendRow}>
            <span className={styles.legendSwatch} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendValue}>{s.valueLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
