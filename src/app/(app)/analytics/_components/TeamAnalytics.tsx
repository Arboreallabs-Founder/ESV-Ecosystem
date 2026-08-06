'use client'

import { useMemo, useState } from 'react'
import { SCORE_PERIOD_LABELS } from '@/lib/types'
import type { PerformanceAdjustment, PerformanceRow, PerformanceWeights, ScorePeriod } from '@/lib/types'
import { MagnitudeBars, ScoreTile } from './PerformanceCharts'
import PeriodPicker from './PeriodPicker'
import AdjustmentModal from './AdjustmentModal'
import WeightsPanel from './WeightsPanel'
import Avatar from '@/app/_components/Avatar'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../analytics.module.css'

type SortKey = 'score' | 'kudosReceived' | 'onTimeRate' | 'tasksOverdue'

export default function TeamAnalytics({
  rows, adjustments, weights, period, canEditWeights,
}: {
  rows: PerformanceRow[]
  adjustments: PerformanceAdjustment[]
  weights: PerformanceWeights
  period: ScorePeriod
  canEditWeights: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [showAdjust, setShowAdjust] = useState(false)
  const [showWeights, setShowWeights] = useState(false)

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      // Nulls (no completed tasks) sort last rather than reading as 0% — "no data" isn't "bad".
      const av = a[sortKey], bv = b[sortKey]
      if (av === null) return 1
      if (bv === null) return -1
      return (bv as number) - (av as number)
    })
  }, [rows, sortKey])

  const active = rows.filter((r) => r.tasksTotal > 0 || r.kudosReceived > 0 || r.adjustmentCount > 0)
  const orgKudos = rows.reduce((s, r) => s + r.kudosReceived, 0)
  const orgOverdue = rows.reduce((s, r) => s + r.tasksOverdue, 0)
  const orgOnTime = rows.reduce((s, r) => s + r.tasksOnTime, 0)

  // Org-wide kudos by area, merged across everyone.
  const kudosByArea = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      for (const [cat, n] of Object.entries(r.kudosByCategory)) m.set(cat, (m.get(cat) ?? 0) + n)
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [rows])

  const topScorers = sorted.slice(0, 8).map((r) => ({ label: r.user_name, value: Math.max(r.score, 0) }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Team analytics</div>
          <div className={styles.pageSub}>{SCORE_PERIOD_LABELS[period]} · {active.length} people with activity</div>
        </div>
        <div className={styles.headerActions}>
          <PeriodPicker period={period} />
          <button className={styles.ghostBtn} onClick={() => setShowAdjust(true)}>+ Adjustment</button>
          {canEditWeights && (
            <button className={styles.ghostBtn} onClick={() => setShowWeights(true)}>Weights</button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={panels.kpiStrip}>
          <ScoreTile label="Kudos given" value={orgKudos} />
          <ScoreTile label="Tasks on time" value={orgOnTime} tone="pos" />
          <ScoreTile label="Overdue" value={orgOverdue} tone={orgOverdue > 0 ? 'neg' : undefined} />
          <ScoreTile label="Adjustments logged" value={adjustments.length} />
        </div>

        <div className={styles.chartGrid}>
          <section className={panels.panel}>
            <h2 className={panels.panelTitle}>Score</h2>
            <p className={panels.panelFoot}>
              Weighted total per person. Scores are relative and period-scoped — read them
              alongside the rates in the table, not on their own.
            </p>
            <MagnitudeBars rows={topScorers} emptyLabel="No scored activity in this period" />
          </section>

          <section className={panels.panel}>
            <h2 className={panels.panelTitle}>Kudos by area</h2>
            <p className={panels.panelFoot}>Across the whole team.</p>
            <MagnitudeBars rows={kudosByArea} emptyLabel="No kudos in this period" />
          </section>
        </div>

        <section className={panels.panel}>
          <div className={panels.tableHead}>
            <h2 className={panels.panelTitle}>Per person</h2>
            <div className={styles.sortRow}>
              <label className={styles.periodLabel} htmlFor="sort">Sort by</label>
              <select id="sort" className={styles.periodSelect} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                <option value="score">Score</option>
                <option value="kudosReceived">Kudos</option>
                <option value="onTimeRate">On-time rate</option>
                <option value="tasksOverdue">Overdue</option>
              </select>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className={panels.chartEmpty}>No people to show.</div>
          ) : (
            <div className={panels.tableScroll}>
              <table className={panels.overviewTable}>
                <thead>
                  <tr>
                    <th>Person</th><th>Score</th><th>Kudos</th><th>On time</th>
                    <th>Overdue</th><th>Pushed</th><th>Recurring</th><th>Events</th><th>Adjust.</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.user_id}>
                      <td className={styles.tdName}>
                        <span className={styles.tdNameInner}>
                          <Avatar name={r.user_name} photoUrl={r.photo_url} size="sm" />
                          <span>{r.user_name}<span className={styles.tdRole}>{r.role}</span></span>
                        </span>
                      </td>
                      <td className={r.score >= 0 ? styles.divValuePos : styles.divValueNeg}>
                        <strong>{r.score}</strong>
                      </td>
                      <td>{r.kudosReceived}</td>
                      <td>{r.onTimeRate === null ? <span className={styles.tdMuted}>—</span> : `${r.onTimeRate}%`}</td>
                      <td className={r.tasksOverdue > 0 ? styles.divValueNeg : undefined}>{r.tasksOverdue}</td>
                      <td>{r.tasksPushed}</td>
                      <td>{r.recurringCompleted}</td>
                      <td>{r.eventsAttended}</td>
                      <td>{r.adjustmentPoints !== 0 ? (r.adjustmentPoints > 0 ? `+${r.adjustmentPoints}` : r.adjustmentPoints) : <span className={styles.tdMuted}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={panels.panel}>
          <h2 className={panels.panelTitle}>Adjustment log</h2>
          {adjustments.length === 0 ? (
            <div className={panels.chartEmpty}>No adjustments in this period</div>
          ) : (
            <div className={styles.adjList}>
              {adjustments.map((a) => (
                <div key={a.id} className={styles.adjRow}>
                  <span className={`${styles.adjPoints} ${a.points > 0 ? styles.divValuePos : styles.divValueNeg}`}>
                    {a.points > 0 ? '+' : ''}{a.points}
                  </span>
                  <Avatar name={a.user?.name} photoUrl={a.user?.photo_url} size="xs" />
                  <span className={styles.adjWho}>{a.user?.name ?? 'Unknown'}</span>
                  <span className={styles.adjReason}>{a.reason}</span>
                  <span className={styles.adjMeta}>
                    {a.occurred_on}{a.created_by_user?.name ? ` · by ${a.created_by_user.name}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showAdjust && (
        <AdjustmentModal people={rows.map((r) => ({ id: r.user_id, name: r.user_name }))} onClose={() => setShowAdjust(false)} />
      )}
      {showWeights && <WeightsPanel weights={weights} onClose={() => setShowWeights(false)} />}
    </div>
  )
}
