'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTask, updateTaskStatus } from '@/app/actions/tasks'
import type { Task, UserRow } from '@/lib/types'
import styles from '../tasks.module.css'

const STATUSES = ['To Do', 'In Progress', 'Done'] as const
type Status = (typeof STATUSES)[number]

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
  const [isPending, startTransition] = useTransition()

  const canCreate = ['founder', 'admin', 'associate'].includes(userRole)

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s)
    return acc
  }, {} as Record<Status, Task[]>)

  function handleStatusChange(taskId: string, newStatus: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t))
    startTransition(async () => { await updateTaskStatus(taskId, newStatus) })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createTask(formData)
      setShowModal(false)
      router.refresh()
    })
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

      <div className={styles.board}>
        {STATUSES.map((status) => (
          <div key={status} className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>{status}</span>
              <span className={styles.columnCount}>{byStatus[status].length}</span>
            </div>
            <div className={styles.columnBody}>
              {byStatus[status].length === 0 ? (
                <div className={styles.emptyCol}>No tasks</div>
              ) : (
                byStatus[status].map((task) => {
                  const due = task.due_date ? formatDue(task.due_date) : null
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
                        {task.assignee?.name && (
                          <span className={styles.metaTag}>{task.assignee.name}</span>
                        )}
                        {due && (
                          <span className={`${styles.metaTag} ${due.isOverdue ? styles.dueDateOverdue : styles.dueDate}`}>
                            {due.isOverdue ? '⚠ ' : ''}{due.label}
                          </span>
                        )}
                      </div>
                      <select
                        className={styles.statusSelect}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        disabled={isPending}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

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
                  <select className={styles.select} name="assignee_id">
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}{u.id === currentUserId ? ' (me)' : ''}
                      </option>
                    ))}
                  </select>
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
    </div>
  )
}
