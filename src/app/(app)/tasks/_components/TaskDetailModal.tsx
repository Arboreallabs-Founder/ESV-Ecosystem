'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getTaskComments, addTaskComment, deleteTaskComment, updateTask } from '@/app/actions/tasks'
import type { Task, TaskComment, UserRow } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import Combobox from '@/app/_components/Combobox'
import styles from '../tasks.module.css'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TaskDetailModal({
  task,
  onClose,
  onUpdated,
  users,
  companyOptions,
  dealOptions,
  currentUserId,
  userRole,
}: {
  task: Task
  onClose: () => void
  onUpdated: (task: Task) => void
  users: UserRow[]
  companyOptions: Array<{ id: string; name: string }>
  dealOptions: Array<{ id: string; name: string }>
  currentUserId: string
  userRole: string
}) {
  const [comments, setComments] = useState<TaskComment[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Same stake-based rule enforced server-side in updateTask — this just gates the button.
  const canEdit = ['founder', 'admin'].includes(userRole)
    || task.created_by === currentUserId
    || task.assigned_by_id === currentUserId
    || task.assignee_id === currentUserId

  const [editing, setEditing] = useState(false)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [noDueDate, setNoDueDate] = useState(!task.due_date)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [linkCompanyId, setLinkCompanyId] = useState(task.company?.id ?? '')
  const [linkDealId, setLinkDealId] = useState(task.desk_deal?.id ?? '')
  const [linkUrl, setLinkUrl] = useState(task.link_url ?? '')
  const [editError, setEditError] = useState<string | null>(null)
  const [editPending, startEditTransition] = useTransition()

  // Same assignment rules as the New Task form: never partners; associates/general
  // may only assign to themselves, other associates, or general.
  const assignableUsers = users.filter((u) => {
    if (u.role === 'franchise_partner' || u.role === 'super_admin') return false
    if (userRole === 'associate' || userRole === 'general' || userRole === 'hr') return u.role === 'associate' || u.role === 'general' || u.role === 'hr' || u.id === currentUserId
    return true
  })
  const assigneeOptions = assignableUsers.map((u) => ({
    id: u.id,
    label: `${u.name || u.email}${u.id === currentUserId ? ' (me)' : ''}`,
  }))

  useEffect(() => {
    let cancelled = false
    getTaskComments(task.id).then((c) => { if (!cancelled) setComments(c) }).catch(() => { if (!cancelled) setComments([]) })
    return () => { cancelled = true }
  }, [task.id])

  function post() {
    const body = text.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      try {
        await addTaskComment(task.id, body)
        setText('')
        setComments(await getTaskComments(task.id))
      } catch (e) { setError((e as Error).message) }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTaskComment(id)
      setComments(await getTaskComments(task.id))
    })
  }

  function startEdit() {
    setAssigneeId(task.assignee_id ?? '')
    setNoDueDate(!task.due_date)
    setDueDate(task.due_date ?? '')
    setLinkCompanyId(task.company?.id ?? '')
    setLinkDealId(task.desk_deal?.id ?? '')
    setLinkUrl(task.link_url ?? '')
    setEditError(null)
    setEditing(true)
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditError(null)
    const formData = new FormData(e.currentTarget)
    startEditTransition(async () => {
      try {
        const updated = await updateTask(task.id, formData)
        onUpdated(updated)
        setEditing(false)
      } catch (err) { setEditError(String(err)) }
    })
  }

  if (editing) {
    return (
      <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setEditing(false)}>
        <form className={`${styles.modal} ${styles.modalWide}`} onSubmit={handleEditSubmit} onMouseDown={(e) => e.stopPropagation()}>
          <div className={styles.modalTitle}>Edit Task</div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Title *</label>
            <input className={styles.input} name="title" required defaultValue={task.title} placeholder="Task title…" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} name="description" defaultValue={task.description ?? ''} placeholder="Optional details…" />
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Assignee *</label>
              <input type="hidden" name="assignee_id" value={assigneeId} />
              <Combobox options={assigneeOptions} value={assigneeId} onChange={setAssigneeId} placeholder="Search a team member…" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Priority</label>
              <select className={styles.select} name="priority" defaultValue={task.priority}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Due Date</label>
              <input
                className={styles.input}
                name="due_date"
                type="date"
                value={noDueDate ? '' : dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={noDueDate}
              />
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={noDueDate}
                  onChange={(e) => { setNoDueDate(e.target.checked); if (e.target.checked) setDueDate('') }}
                />
                No due date — track from assigned date
              </label>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Company</label>
            <input type="hidden" name="company_id" value={linkCompanyId} />
            <Combobox
              options={companyOptions.map((c) => ({ id: c.id, label: c.name }))}
              value={linkCompanyId}
              onChange={setLinkCompanyId}
              placeholder="Search a company profile…"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Deal</label>
            <input type="hidden" name="desk_deal_id" value={linkDealId} />
            <Combobox
              options={dealOptions.map((d) => ({ id: d.id, label: d.name }))}
              value={linkDealId}
              onChange={setLinkDealId}
              placeholder="Search a Deal Desk deal…"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Supporting link</label>
            <input
              className={styles.input}
              name="link_url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          {editError && <div style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{editError}</div>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={editPending || !assigneeId}>
              {editPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{task.title}</div>
        <div className={styles.detailMeta}>
          {task.assignee?.name && <span className={styles.metaTag}>{task.assignee.name}</span>}
          <span className={styles.metaTag}>{task.status}</span>
          <span className={`${styles.priority} ${task.priority === 'High' ? styles.priorityHigh : task.priority === 'Medium' ? styles.priorityMedium : styles.priorityLow}`}>{task.priority}</span>
          {task.due_date ? (
            <span className={styles.metaTag}>Due {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          ) : (
            <span className={styles.metaTag}>Assigned {new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (no due date)</span>
          )}
        </div>
        {(task.assigned_by_user?.name || task.created_by_user?.name) && (
          <div className={styles.assignedBy} style={{ marginTop: '-1rem', marginBottom: '1rem' }}>
            Assigned by {task.assigned_by_user?.name ?? task.created_by_user?.name}
          </div>
        )}
        {task.description && (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>{task.description}</div>
        )}
        {(task.company || task.desk_deal || task.link_url) && (
          <div className={styles.linkChips} style={{ marginBottom: '1.5rem' }}>
            {task.company && (
              <Link href={`/companies/${task.company.id}`} className={styles.linkChipTag}>🏢 {task.company.name}</Link>
            )}
            {task.desk_deal && <span className={styles.linkChipTag}>💼 {task.desk_deal.company_name}</span>}
            {task.link_url && (
              <a href={task.link_url} target="_blank" rel="noreferrer" className={styles.recLinkBtn}>Open link ↗</a>
            )}
          </div>
        )}

        <div className={styles.detailSectionTitle}>Comments</div>
        <div className={styles.commentComposer}>
          <textarea className={styles.textarea} placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className={styles.submitBtn} onClick={post} disabled={pending || !text.trim()}>
              {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Posting…</span> : 'Post'}
            </button>
          </div>
          {error && <div style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem' }}>{error}</div>}
        </div>

        {comments === null ? (
          <div className={styles.commentEmpty}>Loading…</div>
        ) : comments.length === 0 ? (
          <div className={styles.commentEmpty}>No comments yet.</div>
        ) : (
          <div className={styles.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div className={styles.commentHead}>
                  <span className={styles.commentAuthor}>{c.author?.name ?? 'Someone'}</span>
                  <span className={styles.commentDate}>{formatDateTime(c.created_at)}</span>
                  <button className={styles.commentRemove} onClick={() => remove(c.id)} title="Delete">×</button>
                </div>
                <div className={styles.commentBody}>{c.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.modalActions}>
          {canEdit && <button type="button" className={styles.cancelBtn} onClick={startEdit}>Edit</button>}
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
