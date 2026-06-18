'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createEscalation,
  updateEscalationStatus,
  deleteEscalation,
} from '@/app/actions/escalations'
import type { Escalation, EscalationLinkedType, EscalationStatus } from '@/lib/types'
import styles from '../escalations.module.css'

type Option = { id: string; label: string }
type Recipient = { id: string; name: string; role: string }
type Linkable = { deals: Option[]; entries: Option[]; tasks: Option[]; investors: Option[] }

const STATUSES: EscalationStatus[] = ['Open', 'Acknowledged', 'Resolved']
const FILTERS = ['All', ...STATUSES] as const
type Filter = (typeof FILTERS)[number]

const LINK_TYPE_LABEL: Record<EscalationLinkedType, string> = {
  active_deal: 'Deal',
  pipeline_entry: 'Entry',
  task: 'Task',
  investor: 'Investor',
}

function roleLabel(role: string) {
  if (role === 'founder') return 'Founder'
  if (role === 'franchise_partner') return 'Partner'
  if (role === 'admin') return 'Admin'
  if (role === 'associate') return 'Associate'
  return role
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EscalationsList({
  escalations: initial,
  recipients,
  linkable,
  currentUserId,
  userRole,
}: {
  escalations: Escalation[]
  recipients: Recipient[]
  linkable: Linkable
  currentUserId: string
  userRole: string
}) {
  const router = useRouter()
  const [escalations, setEscalations] = useState(initial)
  const [filter, setFilter] = useState<Filter>('All')
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  // New-escalation form state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [linkType, setLinkType] = useState<EscalationLinkedType | ''>('')
  const [linkId, setLinkId] = useState('')

  const canRaise = ['associate', 'admin'].includes(userRole)
  const isLeadership = ['founder', 'admin'].includes(userRole)

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: escalations.length, Open: 0, Acknowledged: 0, Resolved: 0 }
    for (const e of escalations) c[e.status]++
    return c
  }, [escalations])

  const filtered = filter === 'All' ? escalations : escalations.filter((e) => e.status === filter)

  const linkOptions: Option[] =
    linkType === 'active_deal' ? linkable.deals
    : linkType === 'pipeline_entry' ? linkable.entries
    : linkType === 'task' ? linkable.tasks
    : linkType === 'investor' ? linkable.investors
    : []

  function canChangeStatus(e: Escalation) {
    return isLeadership || e.raised_by === currentUserId || e.recipient_user_id === currentUserId
  }
  function canDelete(e: Escalation) {
    return isLeadership || e.raised_by === currentUserId
  }

  function resetForm() {
    setSubject(''); setBody(''); setRecipientId(''); setLinkType(''); setLinkId('')
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!subject.trim() || !recipientId) return
    startTransition(async () => {
      try {
        await createEscalation({
          subject: subject.trim(),
          body: body.trim() || null,
          recipientUserId: recipientId,
          linkedType: linkType || null,
          linkedId: linkType ? (linkId || null) : null,
        })
        setShowModal(false)
        resetForm()
        router.refresh()
      } catch (err) { alert(String(err)) }
    })
  }

  function handleStatus(esc: Escalation, status: EscalationStatus) {
    setEscalations((prev) => prev.map((e) => e.id === esc.id
      ? { ...e, status, resolved_at: status === 'Resolved' ? new Date().toISOString() : null }
      : e))
    startTransition(async () => {
      try { await updateEscalationStatus(esc.id, status) }
      catch (err) { alert(String(err)); router.refresh() }
    })
  }

  function handleDelete(esc: Escalation) {
    if (!confirm('Delete this escalation?')) return
    setEscalations((prev) => prev.filter((e) => e.id !== esc.id))
    startTransition(async () => {
      try { await deleteEscalation(esc.id) }
      catch (err) { alert(String(err)); router.refresh() }
    })
  }

  const founders = recipients.filter((r) => r.role === 'founder')
  const partners = recipients.filter((r) => r.role === 'franchise_partner')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Escalations</div>
          <div className={styles.pageSub}>{counts.Open} open · {escalations.length} total</div>
        </div>
        {canRaise && (
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ New Escalation</button>
        )}
      </div>

      <div className={styles.tabs}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f} <span className={styles.tabCount}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {escalations.length === 0
            ? (canRaise ? 'No escalations yet. Raise one to get started.' : 'No escalations addressed to you yet.')
            : 'No escalations match this filter.'}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((e) => (
            <div key={e.id} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.cardTop}>
                  <span className={styles.subject}>{e.subject}</span>
                  <span className={`${styles.statusBadge} ${styles['status' + e.status]}`}>{e.status}</span>
                </div>
                {e.body && <div className={styles.body}>{e.body}</div>}
                <div className={styles.meta}>
                  <span className={styles.metaItem}>To <strong>{e.recipient_user?.name ?? 'Unknown'}</strong> · {roleLabel(e.recipient_user?.role ?? '')}</span>
                  <span className={styles.metaSep}>·</span>
                  <span className={styles.metaItem}>from {e.raised_by_user?.name ?? 'Unknown'}</span>
                  <span className={styles.metaSep}>·</span>
                  <span className={styles.metaItem}>{formatDate(e.created_at)}</span>
                  {e.linked_type && (
                    <span className={styles.linkedChip}>re: [{LINK_TYPE_LABEL[e.linked_type]}] {e.linked_title ?? '—'}</span>
                  )}
                </div>
              </div>
              <div className={styles.cardActions}>
                {canChangeStatus(e) ? (
                  <select
                    className={styles.statusSelect}
                    value={e.status}
                    onChange={(ev) => handleStatus(e, ev.target.value as EscalationStatus)}
                    disabled={isPending}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : null}
                {canDelete(e) && (
                  <button className={styles.deleteBtn} onClick={() => handleDelete(e)} disabled={isPending} title="Delete">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && canRaise && (
        <div className={styles.overlay} onMouseDown={(ev) => ev.target === ev.currentTarget && setShowModal(false)}>
          <div className={styles.modal} onMouseDown={(ev) => ev.stopPropagation()}>
            <div className={styles.modalTitle}>New Escalation</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Subject *</label>
                <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="What do you need a decision on?" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Details</label>
                <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional context…" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Send to *</label>
                <select className={styles.select} value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required>
                  <option value="">Select a founder or partner…</option>
                  {founders.length > 0 && (
                    <optgroup label="Founders">
                      {founders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  )}
                  {partners.length > 0 && (
                    <optgroup label="Partners">
                      {partners.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Link to (optional)</label>
                  <select
                    className={styles.select}
                    value={linkType}
                    onChange={(e) => { setLinkType(e.target.value as EscalationLinkedType | ''); setLinkId('') }}
                  >
                    <option value="">None</option>
                    <option value="active_deal">Active Deal</option>
                    <option value="pipeline_entry">Pipeline Entry</option>
                    <option value="task">Task</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>
                {linkType && (
                  <div className={styles.field}>
                    <label className={styles.label}>Select {LINK_TYPE_LABEL[linkType]}</label>
                    <select className={styles.select} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                      <option value="">—</option>
                      {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending || !subject.trim() || !recipientId}>
                  {isPending ? 'Sending…' : 'Send Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
