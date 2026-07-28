'use client'

import type { Task, UserRow } from '@/lib/types'
import { computeKpis } from '@/lib/task-kpi'
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

export default function TaskKpiView({
  tasks,
  users,
  userRole,
  currentUserId,
}: {
  tasks: Task[]
  users: UserRow[]
  userRole: string
  currentUserId: string
}) {
  const isAdmin = ['founder', 'admin'].includes(userRole)

  if (!isAdmin) {
    // Associates: their own numbers (RLS already scoped the task set to them).
    const k = computeKpis(tasks)
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
      </div>
    )
  }

  // Founders / admins: per-person breakdown + org total.
  const internalUsers = users.filter((u) => ['founder', 'admin', 'associate', 'general', 'hr'].includes(u.role))
  const rows = internalUsers
    .map((u) => ({ user: u, k: computeKpis(tasks.filter((t) => t.assignee_id === u.id)) }))
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
                <th>Pending</th>
                <th>Not completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, k }) => (
                <tr key={user.id}>
                  <td className={styles.kpiName}>
                    {user.name || user.email}{user.id === currentUserId ? ' (me)' : ''}
                  </td>
                  <td>{k.total}</td>
                  <td>{k.done}</td>
                  <td>{k.onTime}</td>
                  <td>{k.pushed}</td>
                  <td>{k.pending}</td>
                  <td className={k.notCompleted > 0 ? styles.kpiBad : undefined}>{k.notCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
