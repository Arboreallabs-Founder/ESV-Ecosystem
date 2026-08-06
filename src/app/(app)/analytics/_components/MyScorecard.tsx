'use client'

import { SCORE_PERIOD_LABELS } from '@/lib/types'
import type { PerformanceAdjustment, PerformanceRow, PerformanceWeights, ScorePeriod } from '@/lib/types'
import { ContributionBars, MagnitudeBars, ScoreTile } from './PerformanceCharts'
import PeriodPicker from './PeriodPicker'
import Avatar from '@/app/_components/Avatar'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../analytics.module.css'

const CONTRIBUTION_LABELS: Record<string, string> = {
  kudos_received: 'Kudos received',
  task_on_time: 'Tasks on time',
  task_overdue: 'Tasks overdue',
  task_pushed: 'Deadlines pushed',
  recurring_completed: 'Recurring duties',
  event_attended: 'Events attended',
  adjustments: 'Manual adjustments',
}

export default function MyScorecard({ row, adjustments, weights, period }: {
  row: PerformanceRow | null
  adjustments: PerformanceAdjustment[]
  weights: PerformanceWeights
  period: ScorePeriod
}) {
  if (!row) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <div className={styles.pageTitle}>My scorecard</div>
            <div className={styles.pageSub}>No activity recorded yet</div>
          </div>
        </div>
        <div className={styles.empty}>Nothing scored for you yet — kudos, task punctuality and event attendance will show up here.</div>
      </div>
    )
  }

  const contributions = Object.entries(row.contributions).map(([key, value]) => ({
    label: CONTRIBUTION_LABELS[key] ?? key,
    value,
  }))
  const kudosRows = Object.entries(row.kudosByCategory).map(([label, value]) => ({ label, value }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>My scorecard</div>
          <div className={styles.pageSub}>{SCORE_PERIOD_LABELS[period]}</div>
        </div>
        <PeriodPicker period={period} />
      </div>

      <div className={styles.content}>
        <div className={panels.kpiStrip}>
          <ScoreTile label="Score" value={row.score} tone={row.score >= 0 ? 'pos' : 'neg'} />
          <ScoreTile label="Kudos received" value={row.kudosReceived} />
          <ScoreTile
            label="On-time rate"
            value={row.onTimeRate === null ? '—' : `${row.onTimeRate}%`}
            sub={row.onTimeRate === null ? 'No completed tasks yet' : `${row.tasksOnTime} of ${row.tasksOnTime + (row.tasksTotal - row.tasksOnTime - row.tasksOverdue)} closed`}
          />
          <ScoreTile label="Overdue" value={row.tasksOverdue} tone={row.tasksOverdue > 0 ? 'neg' : undefined} />
        </div>

        <div className={styles.chartGrid}>
          <section className={panels.panel}>
            <h2 className={panels.panelTitle}>What made up your score</h2>
            <p className={panels.panelFoot}>
              Bars run right for points gained, left for points lost. Current weights:
              kudos {weights.kudos_received}, on-time {weights.task_on_time},
              overdue {weights.task_overdue}, pushed {weights.task_pushed}.
            </p>
            <ContributionBars items={contributions} />
          </section>

          <section className={panels.panel}>
            <h2 className={panels.panelTitle}>Kudos by area</h2>
            <MagnitudeBars rows={kudosRows} emptyLabel="No kudos in this period yet" />
          </section>
        </div>

        <section className={panels.panel}>
          <h2 className={panels.panelTitle}>Manual adjustments</h2>
          <p className={panels.panelFoot}>Points added or removed by a founder, admin or HR — always with a reason.</p>
          {adjustments.length === 0 ? (
            <div className={panels.chartEmpty}>None in this period</div>
          ) : (
            <div className={styles.adjList}>
              {adjustments.map((a) => (
                <div key={a.id} className={styles.adjRow}>
                  <span className={`${styles.adjPoints} ${a.points > 0 ? styles.divValuePos : styles.divValueNeg}`}>
                    {a.points > 0 ? '+' : ''}{a.points}
                  </span>
                  <span className={styles.adjReason}>{a.reason}</span>
                  <span className={styles.adjMeta}>
                    {a.occurred_on}
                    {a.created_by_user?.name && (
                      <> · <Avatar name={a.created_by_user.name} photoUrl={a.created_by_user.photo_url} size="xs" /> {a.created_by_user.name}</>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
