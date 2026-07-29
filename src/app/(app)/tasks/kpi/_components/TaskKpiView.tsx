'use client'

import { Fragment, useState } from 'react'
import type { Task, UserRow, TaskPush } from '@/lib/types'
import { computeKpis } from '@/lib/task-kpi'
import { computePushStats, blockerBreakdown } from '@/lib/task-pushes'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../../tasks.module.css'

// computeKpis lives in @/lib/task-kpi so /analytics scores punctuality with exactly the same
// maths — the two pages must never disagree about someone's numbers.

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiValue} style={accent ? { color: accent } : undefined}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
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
            <div className={styles.pageTitle}>My KPIs</div>
            <div className={styles.pageSub}>{k.total} task{k.total !== 1 ? 's' : ''} assigned to you</div>
          </div>
        </div>
        <div className={styles.kpiCardRow}>
          <KpiCard label="Completed on time" value={k.onTime} accent="var(--color-success, #2d8c6e)" />
          <KpiCard label="Pushed" value={k.pushed} accent="var(--color-primary)" />
          <KpiCard label="Pending" value={k.pending} />
          <KpiCard label="Not completed" value={k.notCompleted} accent="var(--color-destructive)" />
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
          <div className={styles.pageTitle}>Team KPIs</div>
          <div className={styles.pageSub}>{orgK.total} task{orgK.total !== 1 ? 's' : ''} across the team</div>
        </div>
      </div>

      <div className={styles.kpiCardRow}>
        <KpiCard label="Completed on time" value={orgK.onTime} accent="var(--color-success, #2d8c6e)" />
        <KpiCard label="Pushed" value={orgK.pushed} accent="var(--color-primary)" />
        <KpiCard label="Pending" value={orgK.pending} />
        <KpiCard label="Not completed" value={orgK.notCompleted} accent="var(--color-destructive)" />
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyCol} style={{ marginTop: '1.5rem' }}>No tasks assigned yet.</div>
      ) : (
        <div className={styles.kpiTableWrap}>
          <table className={styles.kpiTable}>
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
    </div>
  )
}
