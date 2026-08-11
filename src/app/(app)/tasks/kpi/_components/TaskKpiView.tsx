'use client'

import { Fragment, useState } from 'react'
import type { Task, UserRow, TaskPush } from '@/lib/types'
import { computeKpis } from '@/lib/task-kpi'
import type { TaskKpis } from '@/lib/task-kpi'
import { computePushStats, blockerBreakdown } from '@/lib/task-pushes'
import { formatDateTimeIst } from '@/lib/format-datetime'
import Donut from '@/app/_components/charts/Donut'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../../tasks.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

// computeKpis lives in @/lib/task-kpi so /analytics scores punctuality with exactly the same
// maths — the two pages must never disagree about someone's numbers.

// The shared dashboard tile, so this page counts the same way it looks everywhere else.
function Kpi({ label, value, foot }: { label: string; value: number | string; foot?: string }) {
  return (
    <div className={panels.kpi}>
      <div className={panels.kpiLabel}>{label}</div>
      <div className={panels.kpiValue}>{value}</div>
      {foot && <span className={panels.kpiFoot}>{foot}</span>}
    </div>
  )
}

/* Why tasks slipped, read off the task_pushes log. The KPI table's "Pushed" column says how
   often; this says what was in the way — the actual point of making the reason compulsory. */
function PushDetail({ pushes, total }: { pushes: TaskPush[]; total: number }) {
  if (pushes.length === 0) return null
  return (
    <ul className={styles.pushList}>
      {pushes.map((p) => {
        const tags: string[] = []
        if (p.blocked_external) tags.push('External party')
        if (p.blocked_by_user_id) tags.push(`Waiting on ${p.blocked_by_user?.name ?? 'a colleague'}`)
        return (
          <li key={p.id} className={styles.pushItem}>
            <div className={styles.pushMeta}>
              <span className={styles.pushTask}>{p.task?.title ?? 'Task'}</span>
              <span className={styles.pushDate}>{formatDateTimeIst(p.created_at)}</span>
            </div>
            <div className={styles.pushReason}>{p.reason}</div>
            {tags.length > 0 && (
              <div className={styles.pushTags}>
                {tags.map((t) => <span key={t} className={styles.pushTag}>{t}</span>)}
              </div>
            )}
          </li>
        )
      })}
      {total > pushes.length && (
        <li className={styles.pushMore}>Showing the {pushes.length} most recent of {total}.</li>
      )}
    </ul>
  )
}

// On time / late / pending / overdue partition the task set exactly — see computeKpis: every task
// is either done (on time or late) or open (pending or past its deadline). "Pushed" is NOT here on
// purpose: a pushed task is also one of the four, so a slice for it would double-count.
function outcomeMix(k: TaskKpis) {
  return [
    { label: 'Completed on time', count: k.onTime },
    { label: 'Completed late', count: Math.max(0, k.done - k.onTime) },
    { label: 'Pending', count: k.pending },
    { label: 'Overdue', count: k.notCompleted },
  ]
}

// Semantic rather than sequential here: unlike funding or pipeline stages these are outcomes, not
// an ordered scale. The legend still carries every label and count, so nothing reads by colour
// alone.
const OUTCOME_COLOURS = ['#2E7D32', '#D5AE8F', '#A39B95', '#C0392B']

export default function TaskKpiView({
  tasks,
  users,
  pushes,
  userRole,
  currentUserId,
}: {
  tasks: Task[]
  users: UserRow[]
  pushes: TaskPush[]
  userRole: string
  currentUserId: string
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const isAdmin = ['founder', 'admin'].includes(userRole)

  if (!isAdmin) {
    // Associates: their own numbers (RLS already scoped the task set to them).
    const k = computeKpis(tasks)
    const mine = computePushStats(currentUserId, pushes)
    const myBlockers = blockerBreakdown(mine, pushes)
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className={styles.pageTitle}>My KPIs</div>
              <WikiButton sectionKey="taskKpis" />
            </div>
            <div className={styles.pageSub}>{k.total} task{k.total !== 1 ? 's' : ''} assigned to you</div>
          </div>
        </div>
        <div className={panels.overview}>
          <section className={panels.panel}>
            <div className={panels.panelHead}>
              <h2 className={panels.panelTitle}>My numbers</h2>
              <span className={panels.panelNote}>{k.total} task{k.total !== 1 ? 's' : ''}</span>
            </div>
            <div className={panels.kpiStrip}>
              <Kpi label="Completed on time" value={k.onTime} foot="Met the original due date" />
              <Kpi label="Pending" value={k.pending} foot="Still inside the deadline" />
              <Kpi label="Overdue" value={k.notCompleted} foot="Past the deadline, not done" />
              <Kpi label="Pushed" value={k.pushed} foot="Moved at least once" />
            </div>
          </section>
          <div className={panels.overviewSide}>
            <section className={panels.panel}>
              <div className={panels.panelHead}>
                <h2 className={panels.panelTitle}>Outcome mix</h2>
              </div>
              <Donut data={outcomeMix(k)} palette={OUTCOME_COLOURS} centreLabel="My tasks" ariaLabel="My tasks by outcome" />
            </section>
          </div>
        </div>

        {mine.total > 0 && (
          <div className={styles.pushSection}>
            <div className={styles.pushSectionTitle}>Why my tasks moved</div>
            <div className={styles.pushSectionSub}>
              {mine.total} push{mine.total !== 1 ? 'es' : ''}
              {mine.blockedExternal > 0 ? ` · ${mine.blockedExternal} on an external party` : ''}
              {myBlockers.length > 0 ? ` · waiting on ${myBlockers.map((b) => `${b.name} (${b.count})`).join(', ')}` : ''}
            </div>
            <PushDetail pushes={mine.recent} total={mine.total} />
          </div>
        )}
      </div>
    )
  }

  // Founders / admins: per-person breakdown + org total.
  const internalUsers = users.filter((u) => ['founder', 'admin', 'associate', 'general', 'hr'].includes(u.role))
  const rows = internalUsers
    .map((u) => ({
      user: u,
      k: computeKpis(tasks.filter((t) => t.assignee_id === u.id)),
      push: computePushStats(u.id, pushes),
    }))
    .filter((r) => r.k.total > 0)
    .sort((a, b) => b.k.total - a.k.total)

  const orgK = computeKpis(tasks)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Team KPIs</div>
            <WikiButton sectionKey="taskKpis" />
          </div>
          <div className={styles.pageSub}>{orgK.total} task{orgK.total !== 1 ? 's' : ''} across the team</div>
        </div>
      </div>

      <div className={panels.overview}>
        <section className={panels.panel}>
          <div className={panels.panelHead}>
            <h2 className={panels.panelTitle}>Team overview</h2>
            <span className={panels.panelNote}>{orgK.total} task{orgK.total !== 1 ? 's' : ''} across {rows.length} {rows.length === 1 ? 'person' : 'people'}</span>
          </div>
          <div className={panels.kpiStrip}>
            <Kpi label="Completed on time" value={orgK.onTime} foot="Met the original due date" />
            <Kpi label="Pending" value={orgK.pending} foot="Still inside the deadline" />
            <Kpi label="Overdue" value={orgK.notCompleted} foot="Past the deadline, not done" />
            <Kpi label="Pushed" value={orgK.pushed} foot="Moved at least once" />
            <Kpi
              label="On-time rate"
              value={orgK.done > 0 ? `${Math.round((orgK.onTime / orgK.done) * 100)}%` : '—'}
              foot="Of everything completed"
            />
          </div>
        </section>
        <div className={panels.overviewSide}>
          <section className={panels.panel}>
            <div className={panels.panelHead}>
              <h2 className={panels.panelTitle}>Outcome mix</h2>
            </div>
            <Donut data={outcomeMix(orgK)} palette={OUTCOME_COLOURS} centreLabel="All tasks" ariaLabel="Team tasks by outcome" />
          </section>
        </div>
      </div>

      <section className={panels.panel} style={{ marginTop: '1rem' }}>
        <div className={panels.panelHead}>
          <h2 className={panels.panelTitle}>Per person</h2>
          <span className={panels.panelNote}>Expand a row to see why their tasks moved</span>
        </div>
      {rows.length === 0 ? (
        <div className={panels.chartEmpty}>No tasks assigned yet.</div>
      ) : (
        <div className={panels.tableScroll}>
          <table className={panels.overviewTable}>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Total</th>
                <th>Done</th>
                <th>On time</th>
                <th>Pushed</th>
                <th>Blocked ext.</th>
                <th>Waiting on</th>
                <th>Pending</th>
                <th>Not completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, k, push }) => {
                const isOpen = expanded === user.id
                const blockers = blockerBreakdown(push, pushes)
                return (
                  <Fragment key={user.id}>
                    <tr
                      className={push.total > 0 ? styles.kpiRowClickable : undefined}
                      onClick={push.total > 0 ? () => setExpanded(isOpen ? null : user.id) : undefined}
                    >
                      <td className={styles.kpiName}>
                        {push.total > 0 && <span className={styles.kpiCaret}>{isOpen ? '\u25be' : '\u25b8'}</span>}
                        {user.name || user.email}{user.id === currentUserId ? ' (me)' : ''}
                      </td>
                      <td>{k.total}</td>
                      <td>{k.done}</td>
                      <td>{k.onTime}</td>
                      <td>{k.pushed}</td>
                      <td>{push.blockedExternal || '\u2014'}</td>
                      <td>{blockers.length === 0 ? '\u2014' : blockers.map((b) => `${b.name} (${b.count})`).join(', ')}</td>
                      <td>{k.pending}</td>
                      <td className={k.notCompleted > 0 ? styles.kpiBad : undefined}>{k.notCompleted}</td>
                    </tr>
                    {isOpen && (
                      <tr className={styles.kpiDetailRow}>
                        <td colSpan={9}>
                          <PushDetail pushes={push.recent} total={push.total} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </div>
  )
}
