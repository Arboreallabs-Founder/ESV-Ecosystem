'use client'

import { useEffect, useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createTask, updateTaskStatus, pushTask, deleteTask } from '@/app/actions/tasks'
import type { Task, UserRow } from '@/lib/types'
import { weekRange } from '@/lib/week'
import Combobox from '@/app/_components/Combobox'
import InfoHint from '@/app/_components/InfoHint'
import TaskDetailModal from './TaskDetailModal'
import { WikiButton } from '@/app/_components/WikiPanel'
import { formatDateTimeIst, formatDateTimeIstLong } from '@/lib/format-datetime'
import { isPastDue } from '@/lib/task-kpi'
import Avatar from '@/app/_components/Avatar'
import styles from '../tasks.module.css'

const STATUSES = ['To Do', 'Done'] as const
type Status = (typeof STATUSES)[number]

function userRoleLabel(role: string) {
  if (role === 'founder') return 'Founder'
  if (role === 'admin') return 'Admin'
  if (role === 'associate') return 'Associate'
  if (role === 'general') return 'General'
  if (role === 'hr') return 'HR'
  return role
}

function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const cls = priority === 'High' ? styles.priorityHigh : priority === 'Medium' ? styles.priorityMedium : styles.priorityLow
  return <span className={`${styles.priority} ${cls}`}>{priority}</span>
}

function formatDue(dateStr: string) {
  // Overdue only once the due day has fully passed — a task due today is not late today.
  // Shared with /tasks/kpi and /analytics so all three agree; see @/lib/task-kpi.
  const isOverdue = isPastDue(dateStr)
  const label = new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return { label, isOverdue }
}

export default function TaskBoard({
  tasks: initialTasks,
  users,
  companyOptions,
  dealOptions,
  currentUserId,
  userRole,
}: {
  tasks: Task[]
  users: UserRow[]
  companyOptions: Array<{ id: string; name: string }>
  dealOptions: Array<{ id: string; name: string }>
  currentUserId: string
  userRole: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [pushTarget, setPushTarget] = useState<Task | null>(null)
  const [pushDate, setPushDate] = useState('')
  const [pushReason, setPushReason] = useState('')
  const [pushExternal, setPushExternal] = useState(false)
  const [pushInternal, setPushInternal] = useState(false)
  const [pushBlockedBy, setPushBlockedBy] = useState('')
  const [pushError, setPushError] = useState<string | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  // Opened via the alerts bell (?open=<taskId>) — jump straight to that task's detail modal.
  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId) return
    const target = tasks.find((t) => t.id === openId)
    if (target) setDetailTask(target)
    router.replace('/tasks')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  // Associates mostly self-assign or assign peers, so defaulting to "me" is the common
  // case. Founders/admins are almost always delegating — default blank so they have to
  // deliberately pick someone instead of silently self-assigning.
  const defaultAssigneeId = userRole === 'associate' ? currentUserId : ''
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId)
  const [assignedById, setAssignedById] = useState(currentUserId)
  const [noDueDate, setNoDueDate] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [linkCompanyId, setLinkCompanyId] = useState('')
  const [linkDealId, setLinkDealId] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [isPending, startTransition] = useTransition()

  // View / filters / collapse
  const canSeeTeamView = ['founder', 'admin'].includes(userRole)
  // Founders/admins land on the team-wide "By Person" view by default; associates get their own board.
  const [view, setView] = useState<'board' | 'list' | 'people'>(canSeeTeamView ? 'people' : 'board')
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all') // 'all' | 'mine' | userId
  const [collapsedCols, setCollapsedCols] = useState<Set<Status>>(() => new Set<Status>(['Done']))
  function toggleCollapse(s: Status) {
    setCollapsedCols((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n })
  }
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  function togglePerson(id: string) {
    setExpandedPeople((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  // "By Person" done tasks are scoped to this week so completed work doesn't pile up
  // indefinitely — open tasks always show regardless (still on their plate).
  const [weekOffset, setWeekOffset] = useState(0)
  const { start: weekStart, end: weekEnd, label: weekLabel } = weekRange(weekOffset)

  const canCreate = ['founder', 'admin', 'associate', 'general', 'hr'].includes(userRole)
  const canDelete = ['founder', 'admin'].includes(userRole)

  // Assignment rules: never partners; associates/general only to themselves, associates, or general.
  const assignableUsers = users.filter((u) => {
    if (u.role === 'franchise_partner' || u.role === 'super_admin') return false
    if (userRole === 'associate' || userRole === 'general' || userRole === 'hr') return u.role === 'associate' || u.role === 'general' || u.role === 'hr' || u.id === currentUserId
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
  const taskOverdue = (t: Task) => { const d = t.pushed_date ?? t.due_date; return t.status !== 'Done' && !!d && isPastDue(d) }
  const summary = {
    open: filteredTasks.filter((t) => t.status !== 'Done').length,
    overdue: filteredTasks.filter(taskOverdue).length,
    high: filteredTasks.filter((t) => t.status !== 'Done' && t.priority === 'High').length,
    done: filteredTasks.filter((t) => t.status === 'Done').length,
  }

  const assigneeChoices = assignableUsers.filter((u) => tasks.some((t) => t.assignee_id === u.id))

  // "By Person" grouping — one collapsed row per assignee, expandable to their full task list.
  const byPerson = (() => {
    const map = new Map<string, { assigneeId: string; name: string; photoUrl: string | null; role: string; tasks: Task[] }>()
    for (const t of filteredTasks) {
      if (t.status === 'Done') {
        if (!t.completed_at) continue
        const d = new Date(t.completed_at)
        if (d < weekStart || d > weekEnd) continue
      }
      const id = t.assignee_id ?? '__unassigned__'
      if (!map.has(id)) {
        map.set(id, { assigneeId: id, name: t.assignee?.name ?? 'Unassigned', photoUrl: t.assignee?.photo_url ?? null, role: users.find((u) => u.id === id)?.role ?? '', tasks: [] })
      }
      map.get(id)!.tasks.push(t)
    }
    return Array.from(map.values()).sort((a, b) => {
      const aOverdue = a.tasks.filter(taskOverdue).length
      const bOverdue = b.tasks.filter(taskOverdue).length
      if (aOverdue !== bOverdue) return bOverdue - aOverdue
      const aOpen = a.tasks.filter((t) => t.status !== 'Done').length
      const bOpen = b.tasks.filter((t) => t.status !== 'Done').length
      if (aOpen !== bOpen) return bOpen - aOpen
      return a.name.localeCompare(b.name)
    })
  })()

  function handleStatusChange(taskId: string, newStatus: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId
      ? { ...t, status: newStatus as Task['status'], completed_at: newStatus === 'Done' ? new Date().toISOString() : null }
      : t))
    startTransition(async () => { await updateTaskStatus(taskId, newStatus) })
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setDetailTask(updated)
  }

  function handleDelete(task: Task) {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    startTransition(async () => {
      try { await deleteTask(task.id) }
      catch (err) { alertError(err); router.refresh() }
    })
  }

  function resetTaskDraft() {
    setAssigneeId(defaultAssigneeId)
    setAssignedById(currentUserId)
    setNoDueDate(false)
    setDueDate('')
    setShowLinkPanel(false)
    setLinkCompanyId('')
    setLinkDealId('')
    setLinkUrl('')
  }

  function closeModal() {
    setShowModal(false)
    resetTaskDraft()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const newTask = await createTask(formData)
        setTasks((prev) => [newTask, ...prev])
        setShowModal(false)
        resetTaskDraft()
      } catch (err) { alertError(err) }
    })
  }

  function handlePushSubmit() {
    if (!pushTarget || !pushDate) return
    setPushError(null)
    if (!pushReason.trim()) { setPushError('Please give a reason for pushing this task.'); return }
    if (pushInternal && !pushBlockedBy) { setPushError('Choose who this is waiting on.'); return }

    const target = pushTarget
    const payload = {
      reason: pushReason,
      blockedExternal: pushExternal,
      blockedByUserId: pushInternal ? pushBlockedBy : null,
    }
    setTasks((prev) => prev.map((t) => t.id === target.id
      ? { ...t, pushed_date: pushDate, pushed_at: new Date().toISOString(), push_count: (t.push_count ?? 0) + 1 }
      : t))
    closePush()
    startTransition(async () => {
      try { await pushTask(target.id, pushDate, payload) }
      catch (err) { alertError(err); router.refresh() }
    })
  }

  function closePush() {
    setPushTarget(null)
    setPushDate('')
    setPushReason('')
    setPushExternal(false)
    setPushInternal(false)
    setPushBlockedBy('')
    setPushError(null)
  }

  function renderCard(task: Task) {
    const effectiveDue = task.pushed_date ?? task.due_date
    const due = effectiveDue ? formatDue(effectiveDue) : null
    const isAssignee = task.assignee_id === currentUserId
    const isDone = task.status === 'Done'
    return (
      <div key={task.id} className={`${styles.card} ${isDone ? styles.cardDone : ''}`}>
        <div className={styles.cardTop}>
          <div className={`${styles.cardTitle} ${isDone ? styles.cardTitleDone : ''}`}>
            {isDone && <span className={styles.doneCheck}>✓</span>}
            {task.title}
          </div>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '0.375rem', lineHeight: 1.4 }}>
            {task.description}
          </div>
        )}
        <div className={styles.cardMeta}>
          {task.assignee?.name && (
            <span className={styles.metaTag}>
              <Avatar name={task.assignee.name} photoUrl={task.assignee.photo_url} size="sm" />
              {task.assignee.name}
            </span>
          )}
          {due ? (
            <span className={`${styles.metaTag} ${due.isOverdue ? styles.dueDateOverdue : styles.dueDate}`}>
              {due.isOverdue ? '⚠ ' : ''}{due.label}
            </span>
          ) : (
            <span className={styles.metaTag} title={`Assigned ${formatDateTimeIstLong(task.created_at)}`}>
              Assigned {formatDateTimeIst(task.created_at)}
            </span>
          )}
          {task.pushed_at && (
            <span className={styles.pushedTag} title={`Pushed ${task.push_count}×`}>
              ⤳ Pushed{task.push_count > 1 ? ` ${task.push_count}×` : ''}
            </span>
          )}
        </div>
        {(task.company || task.desk_deal || task.link_url) && (
          <div className={styles.cardMeta}>
            {task.company && (
              <Link href={`/companies/${task.company.id}`} className={styles.linkChipTag}>🏢 {task.company.name}</Link>
            )}
            {task.desk_deal && (
              <span className={styles.linkChipTag}>💼 {task.desk_deal.company_name}</span>
            )}
            {task.link_url && (
              <a href={task.link_url} target="_blank" rel="noreferrer" className={styles.linkChipTag}>🔗 Link</a>
            )}
          </div>
        )}
        {(task.assigned_by_user?.name || task.created_by_user?.name) && (
          <div className={styles.assignedBy} title={`Assigned ${formatDateTimeIstLong(task.created_at)}`}>
            Assigned by
            <Avatar
              name={task.assigned_by_user?.name ?? task.created_by_user?.name}
              photoUrl={task.assigned_by_user?.photo_url ?? task.created_by_user?.photo_url}
              size="xs"
            />
            {task.assigned_by_user?.name ?? task.created_by_user?.name}
            {/* When a due date is shown the meta row has no assignment stamp, so surface it here
                instead — otherwise the card would never show when the task landed. */}
            {task.due_date && <> · {formatDateTimeIst(task.created_at)}</>}
          </div>
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
          <button className={styles.commentsBtn} onClick={() => setDetailTask(task)}>Comments</button>
          {canDelete && (
            <button
              className={styles.deleteBtn}
              onClick={() => handleDelete(task)}
              disabled={isPending}
              title="Delete task"
              aria-label="Delete task"
            >
              🗑
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Tasks</div>
            <WikiButton sectionKey="tasks" />
          </div>
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
          {canSeeTeamView && (
            <button className={`${styles.viewBtn} ${view === 'people' ? styles.viewBtnActive : ''}`} onClick={() => setView('people')}>By Person</button>
          )}
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

      {/* By Person view (founder/admin only) */}
      {view === 'people' && canSeeTeamView && (
        <div className={styles.peopleView}>
          <div className={styles.peopleViewHead}>
            <div className={styles.viewToggle}>
              <button type="button" className={styles.viewBtn} onClick={() => setWeekOffset((w) => w - 1)}>← Prev</button>
              <span style={{ padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600 }}>{weekLabel}</span>
              <button type="button" className={styles.viewBtn} onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>Next →</button>
            </div>
            {weekOffset !== 0 && (
              <button
                type="button"
                className={styles.viewBtn}
                onClick={() => setWeekOffset(0)}
                style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
              >
                This week
              </button>
            )}
            <div style={{ flex: 1 }} />
            {byPerson.length > 0 && (
              <>
                <button type="button" className={styles.expandAllBtn} onClick={() => setExpandedPeople(new Set(byPerson.map((p) => p.assigneeId)))}>Expand all</button>
                <button type="button" className={styles.expandAllBtn} onClick={() => setExpandedPeople(new Set())}>Collapse all</button>
              </>
            )}
          </div>
          {byPerson.length === 0 ? (
            <div className={styles.emptyCol} style={{ padding: '3rem' }}>
              {filtering ? 'No tasks match your filters.' : 'Nothing open or completed this week.'}
            </div>
          ) : (
            byPerson.map((p) => {
              const open = expandedPeople.has(p.assigneeId)
              const openTasks = p.tasks.filter((t) => t.status !== 'Done')
              const doneTasks = p.tasks.filter((t) => t.status === 'Done')
              const openCount = openTasks.length
              const overdueCount = p.tasks.filter(taskOverdue).length
              const doneCount = doneTasks.length
              return (
                <div key={p.assigneeId} className={styles.personGroup}>
                  <button
                    type="button"
                    className={styles.personHead}
                    onClick={() => togglePerson(p.assigneeId)}
                    aria-expanded={open}
                  >
                    <svg
                      className={`${styles.personChevron} ${open ? styles.personChevronOpen : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                    <Avatar name={p.name} photoUrl={p.photoUrl} size="md" />
                    <span className={styles.personName}>{p.name}</span>
                    {p.role && <span className={styles.personRole}>{userRoleLabel(p.role)}</span>}
                    <div style={{ flex: 1 }} />
                    <span className={styles.personCounts}>
                      {overdueCount > 0 && <span className={`${styles.personPill} ${styles.personPillOverdue}`}>{overdueCount} overdue</span>}
                      <span className={styles.personPill}>{openCount} open</span>
                      <span className={styles.personPill}>{doneCount} done</span>
                    </span>
                  </button>
                  {open && (
                    <div className={styles.personBodyWrap}>
                      {openTasks.length > 0 && (
                        <div className={styles.personBody}>
                          {openTasks.map(renderCard)}
                        </div>
                      )}
                      {doneTasks.length > 0 && (
                        <>
                          <div className={styles.doneDivider}>Completed this week</div>
                          <div className={styles.personBody}>
                            {doneTasks.map(renderCard)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <form className={styles.modalRow} onSubmit={handleSubmit} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modal}>
              <div className={styles.modalTitle}>New Task</div>
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
                  <label className={styles.label}>Assignee *</label>
                  <input type="hidden" name="assignee_id" value={assigneeId} />
                  <Combobox
                    options={assigneeOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Search a team member…"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Assigned By</label>
                  <input type="hidden" name="assigned_by_id" value={assignedById} />
                  <Combobox
                    options={assigneeOptions}
                    value={assignedById}
                    onChange={setAssignedById}
                    placeholder="Who assigned this?"
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
                <label className={styles.label}>Related records</label>
                <div className={styles.linkChips}>
                  {linkCompanyId && (
                    <span className={styles.linkChip}>
                      🏢 {companyOptions.find((c) => c.id === linkCompanyId)?.name ?? 'Company'}
                      <button type="button" onClick={() => setLinkCompanyId('')} aria-label="Remove company link">×</button>
                    </span>
                  )}
                  {linkDealId && (
                    <span className={styles.linkChip}>
                      💼 {dealOptions.find((d) => d.id === linkDealId)?.name ?? 'Deal'}
                      <button type="button" onClick={() => setLinkDealId('')} aria-label="Remove deal link">×</button>
                    </span>
                  )}
                  {linkUrl && (
                    <span className={styles.linkChip}>
                      🔗 Supporting link
                      <button type="button" onClick={() => setLinkUrl('')} aria-label="Remove supporting link">×</button>
                    </span>
                  )}
                  <button type="button" className={styles.linkAddBtn} onClick={() => setShowLinkPanel(true)}>
                    + Link company / deal / URL
                  </button>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending || !assigneeId}>
                  {isPending ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </div>

            <div className={`${styles.modal} ${styles.linkPanel}`} style={{ display: showLinkPanel ? 'block' : 'none' }}>
              <div className={styles.modalTitle}>Link this task</div>
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
              <div className={styles.modalActions}>
                <button type="button" className={styles.submitBtn} onClick={() => setShowLinkPanel(false)}>Done</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {pushTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && closePush()}>
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

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>
                Reason *
                <InfoHint text="Why the date moved. This is saved to the task's comment thread and rolled up in the KPI view, so patterns in what causes slippage are visible." />
              </label>
              <textarea
                className={styles.textarea}
                value={pushReason}
                onChange={(e) => setPushReason(e.target.value)}
                placeholder="What's holding this up?"
                rows={3}
              />
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={pushExternal} onChange={(e) => setPushExternal(e.target.checked)} />
                Dependent on external party
                <InfoHint text="The delay is caused by someone outside the company — a client, investor, vendor or regulator. Tracked so externally-blocked slippage isn't counted against the assignee." />
              </label>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={pushInternal}
                  onChange={(e) => { setPushInternal(e.target.checked); if (!e.target.checked) setPushBlockedBy('') }}
                />
                Dependent on internal stakeholder
                <InfoHint text="The delay is waiting on a colleague. Pick who — the KPI view shows where work is getting stuck internally, so bottlenecks surface instead of looking like individual slippage." />
              </label>
              {pushInternal && (
                <div style={{ marginTop: '0.5rem' }}>
                  <Combobox
                    options={assigneeOptions.filter((o) => o.id !== currentUserId)}
                    value={pushBlockedBy}
                    onChange={setPushBlockedBy}
                    placeholder="Who are you waiting on?"
                  />
                </div>
              )}
            </div>

            {pushError && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-destructive)', marginBottom: '0.75rem' }}>{pushError}</div>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={closePush}>Cancel</button>
              <button type="button" className={styles.submitBtn} onClick={handlePushSubmit} disabled={isPending || !pushDate || !pushReason.trim()}>
                {isPending ? 'Pushing…' : 'Push Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onUpdated={handleTaskUpdated}
          users={users}
          companyOptions={companyOptions}
          dealOptions={dealOptions}
          currentUserId={currentUserId}
          userRole={userRole}
        />
      )}
    </div>
  )
}
