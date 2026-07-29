'use client'

import { useMemo, useState } from 'react'
import type { Task, ActiveDeal, UserRow, PersonalTodo } from '@/lib/types'
import { weekRange } from '@/lib/week'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../../tasks.module.css'

type AssociateReport = {
  id: string
  name: string
  completed: string[]
  open: string[]
  /** Already rendered as `Deal — Latest update`, or just the deal name when there's no update yet. */
  mandates: string[]
  personal: Array<{ title: string; done: boolean }>
}

function buildMessage(report: AssociateReport, weekLabel: string): string {
  const lines: string[] = []
  lines.push(`*${report.name}* — Week of ${weekLabel}`)
  lines.push('')
  lines.push(`✅ Completed (${report.completed.length})`)
  if (report.completed.length === 0) lines.push('None')
  else report.completed.forEach((title, i) => lines.push(`${i + 1}. ${title}`))
  lines.push('')
  lines.push(`🔲 Open (${report.open.length})`)
  if (report.open.length === 0) lines.push('None')
  else report.open.forEach((title, i) => lines.push(`${i + 1}. ${title}`))
  if (report.mandates.length > 0) {
    lines.push('')
    // One line per mandate rather than a comma list — each now carries its own latest update,
    // which would be unreadable run together.
    lines.push('📁 Active mandates')
    report.mandates.forEach((m) => lines.push(m))
  }
  if (report.personal.length > 0) {
    lines.push('')
    lines.push(`📝 Personal to-dos (${report.personal.length})`)
    report.personal.forEach((t) => lines.push(`${t.done ? '☑' : '☐'} ${t.title}`))
  }
  return lines.join('\n')
}

export default function WeeklyUpdateClient({
  tasks, activeDeals, users, dealUpdates, weekTodos, currentUserId, currentUserRole,
}: {
  tasks: Task[]
  activeDeals: ActiveDeal[]
  users: UserRow[]
  /** activeDealId -> newest update body. */
  dealUpdates: Record<string, string>
  weekTodos: PersonalTodo[]
  currentUserId: string
  currentUserRole: string
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const founders = useMemo(() => users.filter((u) => ['founder', 'admin'].includes(u.role)), [users])
  const [founderFilter, setFounderFilter] = useState<string>(currentUserRole === 'founder' ? currentUserId : 'all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { start: weekStart, end: weekEnd, label: weekLabel, key: weekKey } = useMemo(() => weekRange(weekOffset), [weekOffset])

  const associates = useMemo(() => users.filter((u) => ['associate', 'admin', 'general', 'hr'].includes(u.role)), [users])

  const reports = useMemo<AssociateReport[]>(() => {
    const inWeek = (dateStr: string) => {
      const d = new Date(dateStr)
      return d >= weekStart && d <= weekEnd
    }
    return associates
      .map((a) => {
        const relevant = tasks.filter((t) =>
          t.assignee_id === a.id && (founderFilter === 'all' || t.assigned_by_id === founderFilter)
        )
        const completed = relevant
          .filter((t) => t.status === 'Done' && t.completed_at && inWeek(t.completed_at))
          .map((t) => t.title)
        const open = relevant.filter((t) => t.status !== 'Done').map((t) => t.title)
        const mandates = activeDeals
          .filter((d) => d.deal_state === 'active' && d.entry?.assignees?.some((x) => x.user_id === a.id))
          .map((d) => {
            const name = d.entry?.title ?? 'Untitled'
            const latest = dealUpdates[d.id]
            return latest ? `${name}: ${latest}` : `${name}: (no update yet)`
          })
        const personal = weekTodos
          .filter((t) => t.user_id === a.id && t.work_week_start === weekKey)
          .map((t) => ({ title: t.title, done: t.done }))
        return { id: a.id, name: a.name ?? a.email, completed, open, mandates, personal }
      })
      .filter((r) => r.completed.length > 0 || r.open.length > 0 || r.mandates.length > 0 || r.personal.length > 0)
  }, [associates, tasks, activeDeals, dealUpdates, weekTodos, weekKey, founderFilter, weekStart, weekEnd])

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500)
    } catch (err) { alert(String(err)) }
  }

  function copyOne(report: AssociateReport) {
    copyText(buildMessage(report, weekLabel), report.id)
  }

  function copyAll() {
    const text = reports.map((r) => buildMessage(r, weekLabel)).join('\n\n———\n\n')
    copyText(text, '__all__')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Weekly Update</div>
            <WikiButton sectionKey="tasks" />
          </div>
          <div className={styles.pageSub}>A copyable WhatsApp-ready summary of everyone&apos;s week \u2014 tasks, mandate updates, and any personal to-dos filed into this week.</div>
        </div>
        {reports.length > 0 && (
          <button className={styles.addBtn} onClick={copyAll}>
            {copiedId === '__all__' ? 'Copied!' : 'Copy all'}
          </button>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.viewToggle}>
          <button className={styles.viewBtn} onClick={() => setWeekOffset((w) => w - 1)}>← Prev</button>
          <span style={{ padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600 }}>{weekLabel}</span>
          <button className={styles.viewBtn} onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>Next →</button>
        </div>
        {weekOffset !== 0 && (
          <button className={styles.viewBtn} onClick={() => setWeekOffset(0)} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            This week
          </button>
        )}
        <select className={styles.filterSelect} value={founderFilter} onChange={(e) => setFounderFilter(e.target.value)}>
          <option value="all">All founders/admins</option>
          {founders.map((f) => <option key={f.id} value={f.id}>{f.name || f.email}</option>)}
        </select>
      </div>

      {reports.length === 0 ? (
        <div className={styles.emptyCol} style={{ padding: '3rem' }}>Nothing to report for this week.</div>
      ) : (
        <div className={styles.peopleView}>
          {reports.map((report) => (
            <div key={report.id} className={styles.personGroup}>
              <div className={styles.personHead} style={{ cursor: 'default' }}>
                <span className={styles.personName}>{report.name}</span>
                <div style={{ flex: 1 }} />
                <span className={styles.personCounts}>
                  <span className={styles.personPill}>{report.completed.length} done</span>
                  <span className={styles.personPill}>{report.open.length} open</span>
                  {report.mandates.length > 0 && <span className={styles.personPill}>{report.mandates.length} mandate{report.mandates.length === 1 ? '' : 's'}</span>}
                  {report.personal.length > 0 && <span className={styles.personPill}>{report.personal.length} personal</span>}
                </span>
                <button className={styles.expandAllBtn} onClick={() => copyOne(report)}>
                  {copiedId === report.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.personBody} style={{ display: 'block' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, padding: '0.75rem 1rem' }}>
                  {buildMessage(report, weekLabel)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
