'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Task, ActiveDeal, UserRow, PersonalTodo } from '@/lib/types'
import { weekRange } from '@/lib/week'
import { WikiButton } from '@/app/_components/WikiPanel'
import Avatar from '@/app/_components/Avatar'
import styles from '../weekly-update.module.css'

type TaskRef = { id: string; title: string }
/** `update` is empty when nothing has been posted on the deal yet. */
type MandateRef = { id: string; name: string; update: string }

type AssociateReport = {
  id: string
  name: string
  designation: string | null
  photoUrl: string | null
  completed: TaskRef[]
  open: TaskRef[]
  mandates: MandateRef[]
  personal: Array<{ title: string; done: boolean }>
}

/** The exact line the WhatsApp message uses for a mandate. Kept in one place so the card and the
    copied text can never drift apart. */
function mandateLine(m: MandateRef): string {
  return `${m.name}: ${m.update || '(no update yet)'}`
}

/**
 * The WhatsApp-ready text. This is the artifact the exec assistant actually sends, so the card is
 * a *presentation* of it rather than a replacement — the copy button hands over exactly this,
 * unchanged, which is why the format stays deliberately plain.
 */
function buildMessage(report: AssociateReport, weekLabel: string): string {
  const lines: string[] = []
  lines.push(`*${report.name}* — Week of ${weekLabel}`)
  lines.push('')
  lines.push(`✅ Completed (${report.completed.length})`)
  if (report.completed.length === 0) lines.push('None')
  else report.completed.forEach((t, i) => lines.push(`${i + 1}. ${t.title}`))
  lines.push('')
  lines.push(`🔲 Open (${report.open.length})`)
  if (report.open.length === 0) lines.push('None')
  else report.open.forEach((t, i) => lines.push(`${i + 1}. ${t.title}`))
  if (report.mandates.length > 0) {
    lines.push('')
    // One line per mandate rather than a comma list — each carries its own latest update, which
    // would be unreadable run together.
    lines.push('📁 Active mandates')
    report.mandates.forEach((m) => lines.push(mandateLine(m)))
  }
  if (report.personal.length > 0) {
    lines.push('')
    lines.push(`📝 Personal to-dos (${report.personal.length})`)
    report.personal.forEach((t) => lines.push(`${t.done ? '☑' : '☐'} ${t.title}`))
  }
  return lines.join('\n')
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

function Section({
  icon, title, count, children, empty,
}: {
  icon: string
  title: string
  count: number
  children: React.ReactNode
  empty: string
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden="true">{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{count}</span>
      </h3>
      {count === 0 ? <p className={styles.sectionEmpty}>{empty}</p> : children}
    </section>
  )
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
  const [copied, setCopied] = useState<string | null>(null)
  const [index, setIndex] = useState(0)

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
          .map((t) => ({ id: t.id, title: t.title }))
        const open = relevant.filter((t) => t.status !== 'Done').map((t) => ({ id: t.id, title: t.title }))
        const mandates = activeDeals
          .filter((d) => d.deal_state === 'active' && d.entry?.assignees?.some((x) => x.user_id === a.id))
          .map((d) => ({ id: d.id, name: d.entry?.title ?? 'Untitled', update: dealUpdates[d.id] ?? '' }))
        const personal = weekTodos
          .filter((t) => t.user_id === a.id && t.work_week_start === weekKey)
          .map((t) => ({ title: t.title, done: t.done }))
        return {
          id: a.id,
          name: a.name ?? a.email,
          designation: a.designation,
          photoUrl: a.photo_url,
          completed, open, mandates, personal,
        }
      })
      .filter((r) => r.completed.length > 0 || r.open.length > 0 || r.mandates.length > 0 || r.personal.length > 0)
  }, [associates, tasks, activeDeals, dealUpdates, weekTodos, weekKey, founderFilter, weekStart, weekEnd])

  // Changing the week or the filter can shorten the list out from under the current position.
  useEffect(() => {
    setIndex((i) => (reports.length === 0 ? 0 : Math.min(i, reports.length - 1)))
  }, [reports.length])

  // Wraps rather than stopping at the ends: with a handful of people, a dead arrow is more
  // annoying than looping round.
  const go = useCallback((delta: number) => {
    setIndex((i) => (reports.length === 0 ? 0 : (i + delta + reports.length) % reports.length))
  }, [reports.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack the arrows while someone is inside the week or filter controls.
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied((prev) => (prev === id ? null : prev)), 1600)
    } catch (err) { alert(String(err)) }
  }

  function copyAll() {
    copyText(reports.map((r) => buildMessage(r, weekLabel)).join('\n\n———\n\n'), '__all__')
  }

  const report = reports[index]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>Weekly Update</h1>
            <WikiButton sectionKey="tasks" />
          </div>
          <p className={styles.pageSub}>
            One card per person — tasks, mandate updates, and any personal to-dos filed into this week.
          </p>
        </div>
        {reports.length > 0 && (
          <button className={styles.copyAllBtn} onClick={copyAll}>
            {copied === '__all__' ? 'Copied all ✓' : `Copy all ${reports.length}`}
          </button>
        )}
      </header>

      <div className={styles.controls}>
        <div className={styles.weekNav}>
          <button className={styles.weekBtn} onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">←</button>
          <span className={styles.weekLabel}>{weekLabel}</span>
          <button className={styles.weekBtn} onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0} aria-label="Next week">→</button>
        </div>
        {weekOffset !== 0 && (
          <button className={styles.thisWeekBtn} onClick={() => setWeekOffset(0)}>This week</button>
        )}
        <select className={styles.filterSelect} value={founderFilter} onChange={(e) => setFounderFilter(e.target.value)}>
          <option value="all">All founders/admins</option>
          {founders.map((f) => <option key={f.id} value={f.id}>{f.name || f.email}</option>)}
        </select>
      </div>

      {!report ? (
        <div className={styles.empty}>Nothing to report for this week.</div>
      ) : (
        <>
          <div className={styles.stage}>
            <button
              className={`${styles.arrow} ${styles.arrowLeft}`}
              onClick={() => go(-1)}
              disabled={reports.length < 2}
              aria-label="Previous person"
            >
              <ChevronIcon dir="left" />
            </button>

            {/* Keyed on the person so React remounts the card — that's what replays the entry
                animation and resets the body scroll when you move between people. */}
            <article key={report.id} className={styles.card}>
              <div className={styles.cardHead}>
                <Avatar name={report.name} photoUrl={report.photoUrl} size="lg" />
                <div className={styles.cardWho}>
                  <div className={styles.cardName}>{report.name}</div>
                  <div className={styles.cardRole}>{report.designation || `Week of ${weekLabel}`}</div>
                </div>
                <div className={styles.cardCount}>{index + 1}/{reports.length}</div>
              </div>

              <div className={styles.stats}>
                <span className={styles.stat}><b>{report.completed.length}</b> done</span>
                <span className={styles.stat}><b>{report.open.length}</b> open</span>
                {report.mandates.length > 0 && (
                  <span className={styles.stat}><b>{report.mandates.length}</b> mandate{report.mandates.length === 1 ? '' : 's'}</span>
                )}
                {report.personal.length > 0 && (
                  <span className={styles.stat}><b>{report.personal.length}</b> personal</span>
                )}
              </div>

              <div className={styles.cardBody}>
                <Section icon="✅" title="Completed" count={report.completed.length} empty="Nothing completed this week.">
                  <ol className={styles.numberList}>
                    {report.completed.map((t) => (
                      <li key={t.id}>
                        {/* ?open= is the task board's existing deep-link — it opens straight
                            into that task's detail modal. */}
                        <Link href={`/tasks?open=${t.id}`} className={styles.entryLink}>{t.title}</Link>
                      </li>
                    ))}
                  </ol>
                </Section>

                <Section icon="🔲" title="Open" count={report.open.length} empty="No open tasks.">
                  <ol className={styles.numberList}>
                    {report.open.map((t) => (
                      <li key={t.id}>
                        <Link href={`/tasks?open=${t.id}`} className={styles.entryLink}>{t.title}</Link>
                      </li>
                    ))}
                  </ol>
                </Section>

                {report.mandates.length > 0 && (
                  <Section icon="📁" title="Active mandates" count={report.mandates.length} empty="">
                    <ul className={styles.mandateList}>
                      {report.mandates.map((m) => (
                        // The whole block is the target, not just the name — during a call you
                        // want to open the deal while reading its update, not aim at a word.
                        <li key={m.id} className={styles.mandate}>
                          <Link href={`/active-deals/${m.id}`} className={styles.mandateLink}>
                            <span className={styles.mandateName}>
                              {m.name}
                              <span className={styles.mandateArrow} aria-hidden="true">↗</span>
                            </span>
                            <span className={m.update ? styles.mandateUpdate : styles.mandateNone}>
                              {m.update || '(no update yet)'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {report.personal.length > 0 && (
                  <Section icon="📝" title="Personal to-dos" count={report.personal.length} empty="">
                    <ul className={styles.todoList}>
                      {report.personal.map((t, i) => (
                        <li key={i} className={t.done ? styles.todoDone : undefined}>
                          <span className={styles.todoBox} aria-hidden="true">{t.done ? '☑' : '☐'}</span>
                          {t.title}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>

              <footer className={styles.cardFoot}>
                <span className={styles.footHint}>Copies in the WhatsApp format</span>
                <button className={styles.copyBtn} onClick={() => copyText(buildMessage(report, weekLabel), report.id)}>
                  {copied === report.id ? 'Copied ✓' : 'Copy update'}
                </button>
              </footer>
            </article>

            <button
              className={`${styles.arrow} ${styles.arrowRight}`}
              onClick={() => go(1)}
              disabled={reports.length < 2}
              aria-label="Next person"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>

          {reports.length > 1 && (
            <div className={styles.dots}>
              {reports.map((r, i) => (
                <button
                  key={r.id}
                  className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${r.name}`}
                  aria-current={i === index}
                  title={r.name}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
