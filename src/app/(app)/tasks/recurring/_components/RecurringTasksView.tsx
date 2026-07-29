'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createRecurringTask, updateRecurringTask, deleteRecurringTask, setRecurringTaskActive, completeRecurringTask,
  type RecurringTaskInput,
} from '@/app/actions/recurring-tasks'
import { RECURRENCE_TYPES } from '@/lib/types'
import type { RecurringTask, RecurringTaskStatus, RecurrenceType, UserRow } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import Avatar from '@/app/_components/Avatar'
import styles from '../../tasks.module.css'

type RecTask = RecurringTask & { status: RecurringTaskStatus }

const RECURRENCE_LABELS: Record<RecurrenceType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function statusBadge(t: RecTask) {
  if (!t.active) return <span className={`${styles.recBadge} ${styles.recBadgeInactive}`}>Paused</span>
  if (t.status === 'overdue') return <span className={`${styles.recBadge} ${styles.recBadgeOverdue}`}>Overdue</span>
  if (t.status === 'upcoming') return <span className={`${styles.recBadge} ${styles.recBadgeUpcoming}`}>Due {formatDate(t.next_due_date)}</span>
  return <span className={`${styles.recBadge} ${styles.recBadgeOnTrack}`}>Next {formatDate(t.next_due_date)}</span>
}

export default function RecurringTasksView({ tasks, users, isAdmin }: { tasks: RecTask[]; users: UserRow[]; isAdmin: boolean }) {
  const router = useRouter()
  const [filterMode, setFilterMode] = useState<'due' | 'all'>('due')
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<RecTask | 'new' | null>(null)
  const [pending, startTransition] = useTransition()

  const dueTasks = tasks.filter((t) => t.active && (t.status === 'upcoming' || t.status === 'overdue') && !optimisticDone.has(t.id))
  const visible = filterMode === 'due' ? dueTasks : tasks

  function handleComplete(id: string) {
    setOptimisticDone((s) => new Set(s).add(id))
    startTransition(async () => {
      try { await completeRecurringTask(id); router.refresh() }
      catch (e) { alert((e as Error).message); setOptimisticDone((s) => { const n = new Set(s); n.delete(id); return n }) }
    })
  }

  function handleToggleActive(t: RecTask) {
    startTransition(async () => { await setRecurringTaskActive(t.id, !t.active); router.refresh() })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this recurring task? This also removes its completion history.')) return
    startTransition(async () => { await deleteRecurringTask(id); router.refresh() })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Recurring Tasks</div>
            <WikiButton sectionKey="recurringTasks" />
          </div>
          <div className={styles.pageSub}>{dueTasks.length} due now</div>
        </div>
        {isAdmin && <button className={styles.addBtn} onClick={() => setEditing('new')}>+ New recurring task</button>}
      </div>

      <div className={styles.controls}>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${filterMode === 'due' ? styles.viewBtnActive : ''}`} onClick={() => setFilterMode('due')}>Due</button>
          <button className={`${styles.viewBtn} ${filterMode === 'all' ? styles.viewBtnActive : ''}`} onClick={() => setFilterMode('all')}>All</button>
        </div>
      </div>

      <div className={styles.recContent}>
        {visible.length === 0 ? (
          <div className={styles.emptyCol} style={{ padding: '3rem' }}>
            {filterMode === 'due' ? 'Nothing due — recurring tasks show up here starting a few days before they’re due.' : 'No recurring tasks yet.'}
          </div>
        ) : (
          <div className={styles.recList}>
            {visible.map((t) => (
              <div key={t.id} className={`${styles.recRow} ${t.status === 'overdue' && t.active ? styles.recRowOverdue : ''} ${!t.active ? styles.recRowInactive : ''}`}>
                <button
                  className={styles.recCheckbox}
                  onClick={() => handleComplete(t.id)}
                  disabled={pending || !t.active}
                  title="Mark done"
                >
                  ✓
                </button>
                <div className={styles.recBody}>
                  <div className={styles.recTitleRow}>
                    <span className={styles.recTitle}>{t.title}</span>
                    {statusBadge(t)}
                  </div>
                  <div className={styles.recMeta}>
                    <span className={styles.metaTag}>{RECURRENCE_LABELS[t.recurrence_type]}</span>
                    {t.assignee?.name && (
                      <span className={styles.metaTag}>
                        <Avatar name={t.assignee.name} photoUrl={t.assignee.photo_url} size="xs" />
                        {t.assignee.name}
                      </span>
                    )}
                    {t.link_url && <a href={t.link_url} target="_blank" rel="noreferrer" className={styles.recLinkBtn}>Open ↗</a>}
                  </div>
                  {t.description && <div className={styles.recDesc}>{t.description}</div>}
                  {t.last_completion && (
                    <div className={styles.recLastDone}>
                      Last done {t.last_completion.completed_by_name ? `by ${t.last_completion.completed_by_name} ` : ''}
                      on {formatDate(t.last_completion.completed_at)}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className={styles.recActions}>
                    <button className={styles.recIconBtn} onClick={() => setEditing(t)} title="Edit">Edit</button>
                    <button className={styles.recIconBtn} onClick={() => handleToggleActive(t)} title={t.active ? 'Pause' : 'Resume'}>{t.active ? 'Pause' : 'Resume'}</button>
                    <button className={styles.recIconBtn} onClick={() => handleDelete(t.id)} title="Delete">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <RecurringTaskModal
          task={editing === 'new' ? null : editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function RecurringTaskModal({ task, users, onClose, onSaved }: {
  task: RecTask | null; users: UserRow[]; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [linkUrl, setLinkUrl] = useState(task?.link_url ?? '')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(task?.recurrence_type ?? 'weekly')
  const [leadDays, setLeadDays] = useState(String(task?.lead_days ?? 2))
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
  const [nextDueDate, setNextDueDate] = useState(task?.next_due_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!nextDueDate) { setError('A due date is required.'); return }
    const input: RecurringTaskInput = {
      title,
      description: description || null,
      link_url: linkUrl || null,
      recurrence_type: recurrenceType,
      lead_days: Number(leadDays) || 0,
      assignee_id: assigneeId || null,
      next_due_date: nextDueDate,
    }
    startTransition(async () => {
      try {
        if (task) await updateRecurringTask(task.id, input)
        else await createRecurringTask(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{task ? 'Edit recurring task' : 'New recurring task'}</div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Title *</label>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Self-reflection form" />
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Description</label>
          <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Supporting link</label>
          <input className={styles.input} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://forms.google.com/…" />
        </div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Repeats</label>
            <select className={styles.select} value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}>
              {RECURRENCE_TYPES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{task ? 'Next due date' : 'First due date'} *</label>
            <input className={styles.input} type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Show this many days before due</label>
            <input className={styles.input} type="number" min={0} value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Assignee (optional)</label>
            <select className={styles.select} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Team-wide</option>
              {users.filter((u) => u.role !== 'franchise_partner' && u.role !== 'super_admin').map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <div style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.submitBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : task ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
