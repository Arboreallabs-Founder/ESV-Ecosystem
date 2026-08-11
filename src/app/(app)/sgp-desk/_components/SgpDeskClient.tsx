'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { intakePartnerCompany, closePartnerCompany } from '@/app/actions/partner-companies'
import {
  SGP_INTAKE_ACTIONS, SGP_INTAKE_ACTION_LABELS, SGP_INTAKE_ACTION_HINTS,
} from '@/lib/types'
import type { PartnerCompany, SgpIntakeAction, SupportingLink, UserRow } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../sgp-desk.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

type Tab = 'queue' | 'assigned' | 'closed'

export default function SgpDeskClient({
  submissions, assignable, currentUserId,
}: {
  submissions: PartnerCompany[]
  assignable: UserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('queue')
  const [intakeTarget, setIntakeTarget] = useState<PartnerCompany | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Intake form state
  const [action, setAction] = useState<SgpIntakeAction>('first_call')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [links, setLinks] = useState<SupportingLink[]>([{ label: '', url: '' }])

  const byTab = useMemo(() => ({
    queue: submissions.filter((s) => s.status === 'submitted'),
    assigned: submissions.filter((s) => s.status === 'assigned'),
    closed: submissions.filter((s) => s.status === 'closed'),
  }), [submissions])

  const shown = byTab[tab]

  function openIntake(s: PartnerCompany) {
    setIntakeTarget(s)
    setAction('first_call')
    setAssignedTo('')
    setNotes('')
    setDueDate('')
    setLinks([{ label: '', url: '' }])
    setError(null)
  }

  function handleIntake(e: React.FormEvent) {
    e.preventDefault()
    if (!intakeTarget) return
    setError(null)
    if (!assignedTo) { setError('Choose who this goes to.'); return }

    startTransition(async () => {
      try {
        await intakePartnerCompany({
          submissionId: intakeTarget.id,
          action,
          assignedTo,
          supportingLinks: links.filter((l) => l.url.trim()),
          coordinatorNotes: notes,
          dueDate: dueDate || null,
        })
        setIntakeTarget(null)
        setTab('assigned')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  function handleClose(s: PartnerCompany) {
    const reason = prompt(`Close "${s.name}"?\n\nThe partner will see this reason.`)
    if (!reason?.trim()) return
    startTransition(async () => {
      try { await closePartnerCompany(s.id, reason); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.pageTitle}>SGP Desk</h1>
            <WikiButton sectionKey="sgpDesk" />
          </div>
          <p className={styles.pageSub}>
            Companies sourced by partners. Decide what happens next and hand it to someone — the
            assignee gets it as a task on their board.
          </p>
        </div>
      </header>

      <div className={styles.tabs}>
        {([
          ['queue', 'To triage', byTab.queue.length],
          ['assigned', 'Assigned', byTab.assigned.length],
          ['closed', 'Closed', byTab.closed.length],
        ] as Array<[Tab, string, number]>).map(([value, label, count]) => (
          <button
            key={value}
            className={`${styles.tab} ${tab === value ? styles.tabActive : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
            {count > 0 && <span className={styles.tabCount}>{count}</span>}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {shown.length === 0 ? (
        <div className={styles.empty}>
          {tab === 'queue'
            ? 'Nothing waiting. Companies submitted by partners land here.'
            : tab === 'assigned' ? 'Nothing assigned yet.' : 'Nothing closed.'}
        </div>
      ) : (
        <div className={styles.list}>
          {shown.map((s) => (
            <article key={s.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardWho}>
                  <h2 className={styles.cardName}>{s.name}</h2>
                  <div className={styles.cardMeta}>
                    {[s.sector, s.hq_city].filter(Boolean).join(' · ') || 'No sector given'}
                    {s.website && (
                      <>
                        {' · '}
                        <a href={s.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                          {s.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.cardSource}>
                  <Avatar name={s.submitter?.name} photoUrl={s.submitter?.photo_url} size="sm" />
                  <span className={styles.sourceText}>
                    {s.partner?.name || s.submitter?.name || 'Unknown'}
                    <span className={styles.sourceDate}>{formatDateTimeIst(s.created_at)}</span>
                  </span>
                </div>
              </div>

              {s.partner_comments && (
                <blockquote className={styles.comments}>{s.partner_comments}</blockquote>
              )}

              {(s.contact_name || s.contact_email || s.contact_phone) && (
                <div className={styles.contact}>
                  <span className={styles.contactLabel}>Contact</span>
                  {[s.contact_name, s.contact_email, s.contact_phone].filter(Boolean).join(' · ')}
                </div>
              )}

              {s.status === 'assigned' && (
                <div className={styles.outcome}>
                  <span className={styles.outcomeAction}>
                    {s.intake_action ? SGP_INTAKE_ACTION_LABELS[s.intake_action] : 'Assigned'}
                  </span>
                  <span className={styles.outcomeWho}>
                    <Avatar name={s.assignee?.name} photoUrl={s.assignee?.photo_url} size="xs" />
                    {s.assignee?.name ?? 'Unknown'}
                    {s.assigned_at ? ` · ${formatDateTimeIst(s.assigned_at)}` : ''}
                  </span>
                  {s.task_id && (
                    <Link href={`/tasks?open=${s.task_id}`} className={styles.taskLink}>
                      Open task →
                    </Link>
                  )}
                </div>
              )}

              {s.status === 'closed' && s.closed_reason && (
                <div className={styles.closed}>Closed — {s.closed_reason}</div>
              )}

              {s.supporting_links?.length > 0 && (
                <div className={styles.links}>
                  {s.supporting_links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.linkChip}>
                      {l.label || 'Link'}
                    </a>
                  ))}
                </div>
              )}

              {s.status === 'submitted' && (
                <div className={styles.cardActions}>
                  <button className={styles.primaryBtn} onClick={() => openIntake(s)}>Intake</button>
                  <button className={styles.ghostBtn} onClick={() => handleClose(s)} disabled={isPending}>
                    Close
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* ── Intake ── */}
      {intakeTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setIntakeTarget(null)}>
          <form className={styles.modal} onMouseDown={(e) => e.stopPropagation()} onSubmit={handleIntake}>
            <h2 className={styles.modalTitle}>Intake — {intakeTarget.name}</h2>
            <p className={styles.modalSub}>
              Picking an action creates a task for the assignee, carrying the partner&apos;s notes
              and any links you add below.
            </p>

            <div className={styles.field}>
              <span className={styles.label}>What happens next *</span>
              <div className={styles.actionChoices}>
                {SGP_INTAKE_ACTIONS.map((a) => (
                  <label key={a} className={`${styles.choice} ${action === a ? styles.choiceActive : ''}`}>
                    <input
                      type="radio"
                      name="action"
                      value={a}
                      checked={action === a}
                      onChange={() => setAction(a)}
                    />
                    <span>
                      <span className={styles.choiceLabel}>{SGP_INTAKE_ACTION_LABELS[a]}</span>
                      <span className={styles.choiceHint}>{SGP_INTAKE_ACTION_HINTS[a]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span className={styles.label}>Assign to *</span>
                <select className={styles.input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <option value="">Choose someone…</option>
                  {assignable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}{u.id === currentUserId ? ' (me)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Due date</span>
                <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Supporting links</span>
              {links.map((l, i) => (
                <div key={i} className={styles.linkRow}>
                  <input
                    className={styles.input}
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  />
                  <input
                    className={styles.input}
                    placeholder="https://…"
                    value={l.url}
                    onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  />
                  <button
                    type="button"
                    className={styles.rowBtn}
                    onClick={() => setLinks((ls) => ls.length === 1 ? [{ label: '', url: '' }] : ls.filter((_, j) => j !== i))}
                    title="Remove"
                  >×</button>
                </div>
              ))}
              <button type="button" className={styles.ghostBtn} onClick={() => setLinks((ls) => [...ls, { label: '', url: '' }])}>
                + Add another
              </button>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Notes for the assignee</span>
              <textarea
                className={styles.textarea}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything they should know before they start"
              />
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setIntakeTarget(null)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={isPending || !assignedTo}>
                {isPending ? 'Assigning…' : 'Assign & create task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
