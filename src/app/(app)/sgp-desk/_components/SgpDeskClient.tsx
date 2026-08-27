'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError, describeError } from '@/lib/client-errors'
import { intakePartnerEntry } from '@/app/actions/partner-companies'
import {
  SGP_INTAKE_ACTIONS, SGP_INTAKE_ACTION_LABELS, SGP_INTAKE_ACTION_HINTS,
} from '@/lib/types'
import type { SgpIntakeAction, SupportingLink, UserRow } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../sgp-desk.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

/**
 * Partner-sourced companies awaiting triage.
 *
 * These are pipeline entries, not partner_companies rows. The Desk used to render both, which
 * listed every submission twice: 20260906 moved intake onto the Partner Sourced pipeline and
 * carried the old rows across, but the old table was still being fetched and tabbed over. Nothing
 * new has arrived there since, so it was a frozen duplicate of the live board.
 *
 * Deciding here moves the card *and* raises the task. The stage is what the partner sees on their
 * own page, so the two cannot disagree.
 */

export type QueueEntry = {
  id: string
  title: string | null
  submitted_at: string | null
  partner_notes: string | null
  submitter_name: string | null
  submitter_email: string | null
  partner: { name: string } | null
  stage: { id: string; name: string; position: number; stage_type: string } | null
}

type Tab = 'queue' | 'moving' | 'done'

export default function SgpDeskClient({
  entries, assignable,
}: {
  entries: QueueEntry[]
  assignable: UserRow[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('queue')
  const [intakeTarget, setIntakeTarget] = useState<QueueEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [action, setAction] = useState<SgpIntakeAction>('first_call')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [links, setLinks] = useState<SupportingLink[]>([{ label: '', url: '' }])

  // Grouped by where the card actually is, rather than by a status column kept in step by hand.
  const byTab = useMemo(() => ({
    queue: entries.filter((e) => e.stage?.stage_type === 'lead'),
    moving: entries.filter((e) => e.stage && !['lead', 'accepted', 'rejected'].includes(e.stage.stage_type)),
    done: entries.filter((e) => e.stage && ['accepted', 'rejected'].includes(e.stage.stage_type)),
  }), [entries])

  const shown = byTab[tab]

  function openIntake(e: QueueEntry) {
    setIntakeTarget(e)
    setAction('first_call')
    setAssignedTo('')
    setNotes('')
    setDueDate('')
    setLinks([{ label: '', url: '' }])
    setError(null)
  }

  function handleIntake(ev: React.FormEvent) {
    ev.preventDefault()
    if (!intakeTarget) return
    setError(null)
    if (!assignedTo) { setError('Choose who this goes to.'); return }

    startTransition(async () => {
      try {
        await intakePartnerEntry({
          entryId: intakeTarget.id,
          action,
          assignedTo,
          supportingLinks: links.filter((l) => l.url.trim()),
          coordinatorNotes: notes,
          dueDate: dueDate || null,
        })
        setIntakeTarget(null)
        setTab('moving')
        router.refresh()
      } catch (err) {
        setError(describeError(err).message)
        alertError(err)
      }
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
            assignee gets it as a task, and the card moves to match.
          </p>
        </div>
      </header>

      <div className={styles.tabs}>
        {([
          ['queue', 'To triage', byTab.queue.length],
          ['moving', 'In progress', byTab.moving.length],
          ['done', 'Settled', byTab.done.length],
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

      {shown.length === 0 ? (
        <div className={styles.empty}>
          {tab === 'queue'
            ? 'Nothing waiting. Anything a partner submits — typed in or through their link — arrives here.'
            : tab === 'moving'
              ? 'Nothing in progress.'
              : 'Nothing settled yet.'}
        </div>
      ) : (
        <div className={styles.list}>
          {shown.map((e) => (
            <article key={e.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardName}>{e.title ?? 'Untitled'}</h2>
                  <div className={styles.cardMeta}>
                    {e.partner?.name && <span className={styles.partnerTag}>{e.partner.name}</span>}
                    {e.submitted_at && <span>{formatDateTimeIst(e.submitted_at)}</span>}
                  </div>
                </div>
                {e.stage && <span className={styles.stagePill}>{e.stage.name}</span>}
              </div>

              {(e.submitter_name || e.submitter_email) && (
                <div className={styles.cardContact}>
                  {[e.submitter_name, e.submitter_email].filter(Boolean).join(' · ')}
                </div>
              )}

              {/* The partner's own words. The most useful thing in the submission and the reason
                  they bothered — so it is shown in full rather than truncated. */}
              {e.partner_notes && <p className={styles.comments}>{e.partner_notes}</p>}

              {e.stage?.stage_type === 'lead' && (
                <div className={styles.cardActions}>
                  <button className={styles.primaryBtn} onClick={() => openIntake(e)}>
                    Decide what happens next
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {intakeTarget && (
        // onMouseDown, not onClick: a drag that starts inside and ends on the backdrop should not
        // discard what has been typed.
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setIntakeTarget(null)}>
          <form className={styles.modal} onSubmit={handleIntake} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{intakeTarget.title ?? 'Untitled'}</div>
            <p className={styles.modalSub}>
              This raises a task for whoever you pick, carrying the partner&apos;s notes, and moves
              the card so the partner sees where it got to.
            </p>

            <div className={styles.field}>
              <span className={styles.label}>What happens next</span>
              <div className={styles.actionList}>
                {SGP_INTAKE_ACTIONS.map((a) => (
                  <label key={a} className={`${styles.actionOption} ${action === a ? styles.actionOptionOn : ''}`}>
                    <input type="radio" name="action" checked={action === a} onChange={() => setAction(a)} />
                    <span>
                      <span className={styles.actionLabel}>{SGP_INTAKE_ACTION_LABELS[a]}</span>
                      <span className={styles.actionHint}>{SGP_INTAKE_ACTION_HINTS[a]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Who picks it up *</span>
                <select className={styles.input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <option value="">Choose someone</option>
                  {assignable.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Due date</span>
                <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Anything they should know</span>
              <textarea className={styles.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Supporting links</span>
              {links.map((l, i) => (
                <div key={i} className={styles.linkRow}>
                  <input
                    className={styles.input}
                    placeholder="Label"
                    value={l.label ?? ''}
                    onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  />
                  <input
                    className={styles.input}
                    placeholder="https://…"
                    value={l.url}
                    onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  />
                </div>
              ))}
              <button type="button" className={styles.ghostBtn} onClick={() => setLinks((ls) => [...ls, { label: '', url: '' }])}>
                + Another link
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setIntakeTarget(null)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={isPending}>
                {isPending ? 'Handing over…' : 'Hand it over'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
