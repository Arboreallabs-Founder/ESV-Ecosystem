'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTask, updateTaskStatus, pushTask } from '@/app/actions/tasks'
import type { Task, UserRow } from '@/lib/types'
import Combobox from '@/app/_components/Combobox'
import styles from '../tasks.module.css'

const STATUSES = ['To Do', 'Done'] as const
type Status = (typeof STATUSES)[number]

function userRoleLabel(role: string) {
  if (role === 'founder') return 'Founder'
  if (role === 'admin') return 'Admin'
  if (role === 'associate') return 'Associate'
  return role
}

function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const cls = priority === 'High' ? styles.priorityHigh : priority === 'Medium' ? styles.priorityMedium : styles.priorityLow
  return <span className={`${styles.priority} ${cls}`}>{priority}</span>
}

function formatDue(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isOverdue = d < now
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return { label, isOverdue }
}

export default function TaskBoard({
  tasks: initialTasks,
  users,
  currentUserId,
  userRole,
}: {
  tasks: Task[]
  users: UserRow[]
  currentUserId: string
  userRole: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [pushTarget, setPushTarget] = useState<Task | null>(null)
  const [pushDate, setPushDate] = useState('')
  const [assigneeId, setAssigneeId] = useState(currentUserId)
  const [isPending, startTransition] = useTransition()

  // View / filters / collapse
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all') // 'all' | 'mine' | userId
  const [collapsedCols, setCollapsedCols] = useState<Set<Status>>(() => new Set<Status>(['Done']))
  function toggleCollapse(s: Status) {
    setCollapsedCols((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n })
  }

  const canCreate = ['founder', 'admin', 'associate'].includes(userRole)

  // Assignment rules: never partners; associates only to themselves or other associates.
  const assignableUsers = users.filter((u) => {
    if (u.role === 'franchise_partner' || u.role === 'super_admin') return false
    if (userRole === 'associate') return u.role === 'associate' || u.id === currentUserId
    return true
  })

  const assigneeOptions = assignableUsers.map((u) => ({
    id: u.id,
    label: `${u.name || u.email}${u.id === currentUserId ? ' (me)' : ''}`,
    hint: userRoleLabel(u.role),
  }))

  // Search + assignee filter applied to what's shown.
  const filteredTasks = tasks.filter((t) => {
    if (assigneeFilter === 'mine') { if (t.assignee_id !== currentUserId) return false }
    else if (assigneeFilter !== 'all') { if (t.assignee_id !== assigneeFilter) return false }
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!`${t.title} ${t.description ?? ''} ${t.assignee?.name ?? ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })
  const filtering = search.trim() !== '' || assigneeFilter !== 'all'

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filteredTasks.filter((t) => t.status === s)
    return acc
  }, {} as Record<Status, Task[]>)

  // Task summary (respects filters)
  const nowDate = new Date()
  const taskOverdue = (t: Task) => { const d = t.pushed_date ?? t.due_date; return t.status !== 'Done' && !!d && new Date(d) < nowDate }
  const summary = {
    open: filteredTasks.filter((t) => t.status !== 'Done').length,
    overdue: filteredTasks.filter(taskOverdue).length,
    high: filteredTasks.filter((t) => t.status !== 'Done' && t.priority === 'High').length,
    done: filteredTasks.filter((t) => t.status === 'Done').length,
  }

  const assigneeChoices = assignableUsers.filter((u) => tasks.some((t) => t.assignee_id === u.id))

  function handleStatusChange(taskId: string, newStatus: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId
      ? { ...t, status: newStatus as Task['status'], completed_at: newStatus === 'Done' ? new Date().toISOString() : null }
      : t))
    startTransition(async () => { await updateTaskStatus(taskId, newStatus) })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createTask(formData)
        setShowModal(false)
        setAssigneeId(currentUserId)
        router.refresh()
      } catch (err) { alert(String(err)) }
    })
  }

  function handlePushSubmit() {
    if (!pushTarget || !pushDate) return
    const target = pushTarget
    setTasks((prev) => prev.map((t) => t.id === target.id
      ? { ...t, pushed_date: pushDate, pushed_at: new Date().toISOString(), push_count: (t.push_count ?? 0) + 1 }
      : t))
    setPushTarget(null)
    setPushDate('')
    startTransition(async () => {
      try { await pushTask(target.id, pushDate) }
      catch (err) { alert(String(err)); router.refresh() }
    })
  }

  function renderCard(task: Task) {
    const effectiveDue = task.pushed_date ?? task.due_date
    const due = effectiveDue ? formatDue(effectiveDue) : null
    const isAssignee = task.assignee_id === currentUserId
    return (
      <div key={task.id} className={styles.card}>
        <div className={styles.cardTop}>
          <div className={styles.cardTitle}>{task.title}</div>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '0.375rem', lineHeight: 1.4 }}>
            {task.description}
          </div>
        )}
        <div className={styles.cardMeta}>
          {task.assignee?.name && <span className={styles.metaTag}>{task.assignee.name}</span>}
          {due && (
            <span className={`${styles.metaTag} ${due.isOverdue ? styles.dueDateOverdue : styles.dueDate}`}>
              {due.isOverdue ? '⚠ ' : ''}{due.label}
            </span>
          )}
          {task.pushed_at && (
            <span className={styles.pushedTag} title={`Pushed ${task.push_count}×`}>
              ⤳ Pushed{task.push_count > 1 ? ` ${task.push_count}×` : ''}
            </span>
          )}
        </div>
        {task.created_by_user?.name && (
          <div className={styles.assignedBy}>Assigned by {task.created_by_user.name}</div>
        )}
        <div className={styles.cardActions}>
          <select
            className={styles.statusSelect}
            value={task.status}
            onChange={(e) => handleStatusChange(task.id, e.target.value)}
            disabled={isPending}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {isAssignee && task.status !== 'Done' && (
            <button
              className={styles.pushBtn}
              onClick={() => { setPushTarget(task); setPushDate(task.pushed_date ?? task.due_date ?? '') }}
              disabled={isPending}
            >
              Push
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Tasks</div>
          <div className={styles.pageSub}>{tasks.filter((t) => t.status !== 'Done').length} open task{tasks.filter((t) => t.status !== 'Done').length !== 1 ? 's' : ''}</div>
        </div>
        {canCreate && (
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ New Task</button>
        )}
      </div>

      {/* Controls: search + assignee filter + view toggle */}
      <div className={styles.controls}>
        <input className={styles.search} placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="all">All assignees</option>
          <option value="mine">My tasks</option>
          {assigneeChoices.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'board' ? styles.viewBtnActive : ''}`} onClick={() => setView('board')}>Board</button>
          <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryPill}><span className={styles.summaryNum}>{summary.open}</span><span className={styles.summaryLabel}>Open</span></div>
        <div className={`${styles.summaryPill} ${summary.overdue > 0 ? styles.summaryOverdue : ''}`}><span className={styles.summaryNum}>{summary.overdue}</span><span className={styles.summaryLabel}>Overdue</span></div>
        <div className={`${styles.summaryPill} ${summary.high > 0 ? styles.summaryHigh : ''}`}><span className={styles.summaryNum}>{summary.high}</span><span className={styles.summaryLabel}>High priority</span></div>
        <div className={styles.summaryPill}><span className={styles.summaryNum}>{summary.done}</span><span className={styles.summaryLabel}>Done</span></div>
      </div>

      {/* Board view */}
      {view === 'board' && (
        <div className={styles.board}>
          {STATUSES.map((status) => {
            if (collapsedCols.has(status)) {
              return (
                <div key={status} className={styles.columnRail} onClick={() => toggleCollapse(status)} title={`Expand ${status}`}>
                  <span className={styles.railCount}>{byStatus[status].length}</span>
                  <span className={styles.railName}>{status}</span>
                </div>
              )
            }
            return (
              <div key={status} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button className={styles.collapseBtn} onClick={() => toggleCollapse(status)} title="Collapse">‹</button>
                    <span className={styles.columnTitle}>{status}</span>
                  </div>
                  <span className={styles.columnCount}>{byStatus[status].length}</span>
                </div>
                <div className={styles.columnBody}>
                  {byStatus[status].length === 0 ? (
                    <div className={styles.emptyCol}>{filtering ? 'No matches' : 'No tasks'}</div>
                  ) : (
                    byStatus[status].map(renderCard)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className={styles.listView}>
          {STATUSES.map((status) => byStatus[status].length === 0 ? null : (
            <div key={status} className={styles.listGroup}>
              <div className={styles.listGroupHead}>
                <span className={styles.listGroupName}>{status}</span>
                <span className={styles.columnCount}>{byStatus[status].length}</span>
              </div>
              <div className={styles.listCards}>{byStatus[status].map(renderCard)}</div>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <div className={styles.emptyCol} style={{ padding: '3rem' }}>{filtering ? 'No tasks match your filters.' : 'No tasks yet.'}</div>
          )}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Task</div>
            <form onSubmit={handleSubmit}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Title *</label>
                <input className={styles.input} name="title" required placeholder="Task title…" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} name="description" placeholder="Optional details…" />
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Assignee</label>
                  <input type="hidden" name="assignee_id" value={assigneeId} />
                  <Combobox
                    options={assigneeOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Search a team member…"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Priority</label>
                  <select className={styles.select} name="priority" defaultValue="Medium">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Due Date</label>
                  <input className={styles.input} name="due_date" type="date" />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pushTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setPushTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Push Task</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Pushing “{pushTarget.title}” records a new target date. The original due date stays on record.
            </p>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>New target date *</label>
              <input
                className={styles.input}
                type="date"
                value={pushDate}
                onChange={(e) => setPushDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setPushTarget(null)}>Cancel</button>
              <button type="button" className={styles.submitBtn} onClick={handlePushSubmit} disabled={isPending || !pushDate}>
                {isPending ? 'Pushing…' : 'Push Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
