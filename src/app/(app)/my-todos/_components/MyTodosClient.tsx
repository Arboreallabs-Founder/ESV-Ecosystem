'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addPersonalTodo, updatePersonalTodo, deletePersonalTodo, togglePersonalTodo, portTaskIn, unlinkPersonalTodo,
} from '@/app/actions/personal-todos'
import type { PersonalTodo, Task } from '@/lib/types'
import { isPastDue } from '@/lib/task-kpi'
import { weekRange } from '@/lib/week'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../my-todos.module.css'
import { alertError } from '@/lib/client-errors'

/* Work weeks offered on an item: a couple back for catching up, a few forward for planning.
   Filing an item into a week is also what publishes it to that week's update, so the option list
   doubles as the "share this" control — hence the explicit "Not in a week" default. */
const WEEK_OPTIONS = [-2, -1, 0, 1, 2, 3].map((offset) => {
  const { label, key } = weekRange(offset)
  const suffix = offset === 0 ? ' (this week)' : offset === 1 ? ' (next week)' : offset === -1 ? ' (last week)' : ''
  return { key, label: `${label}${suffix}` }
})

const WEEK_LABELS = new Map(WEEK_OPTIONS.map((w) => [w.key, w.label]))

function formatDue(dateStr: string) {
  // Same rule as the task board: overdue only after the due day has fully passed.
  return {
    label: new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    isOverdue: isPastDue(dateStr),
  }
}

function TodoRow({ todo, isDone, expanded, pending, onToggle, onToggleExpand, onDelete, onUnlink, onSave }: {
  todo: PersonalTodo; isDone: boolean; expanded: boolean; pending: boolean
  onToggle: () => void; onToggleExpand: () => void; onDelete: () => void; onUnlink: () => void
  onSave: (notes: string, dueDate: string, workWeek: string) => void
}) {
  const [notes, setNotes] = useState(todo.notes ?? '')
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const [workWeek, setWorkWeek] = useState(todo.work_week_start ?? '')
  const due = todo.due_date ? formatDue(todo.due_date) : null
  // A week outside the offered range (an old item) still deserves a readable chip.
  const weekLabel = todo.work_week_start ? WEEK_LABELS.get(todo.work_week_start) ?? todo.work_week_start : null

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <button className={`${styles.checkbox} ${isDone ? styles.checkboxDone : ''}`} onClick={onToggle} aria-label="Toggle done">
          {isDone && '✓'}
        </button>
        <div className={styles.rowBody}>
          <div className={`${styles.rowTitle} ${isDone ? styles.rowTitleDone : ''}`}>{todo.title}</div>
          {(todo.notes || due || todo.linked_task || weekLabel) && (
            <div className={styles.rowMeta}>
              {todo.linked_task && <span className={styles.linkedChip}>Linked · {todo.linked_task.status}</span>}
              {weekLabel && <span className={styles.weekChip} title="Shows in this week's update">Week of {weekLabel}</span>}
              {due && <span className={`${styles.dueChip} ${due.isOverdue && !isDone ? styles.dueChipOverdue : ''}`}>{due.label}</span>}
              {todo.notes && <span className={styles.notesPreview}>{todo.notes}</span>}
            </div>
          )}
        </div>
        <div className={styles.rowActions}>
          <button className={styles.iconBtn} onClick={onToggleExpand} title="Edit">⋯</button>
          <button className={styles.iconBtn} onClick={onDelete} title="Remove">×</button>
        </div>
      </div>
      {expanded && (
        <div className={styles.rowExpand}>
          <textarea className={styles.textarea} placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <div className={styles.expandRow}>
            <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <select
              className={styles.input}
              value={workWeek}
              onChange={(e) => setWorkWeek(e.target.value)}
              title="Assigning a work week adds this item to that week's update"
            >
              <option value="">Not in a work week</option>
              {WEEK_OPTIONS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
            {todo.linked_task_id && <button className={styles.ghostBtn} onClick={onUnlink}>Unlink from task</button>}
            <div style={{ flex: 1 }} />
            <button className={styles.ghostBtn} onClick={onToggleExpand} disabled={pending}>Cancel</button>
            <button className={styles.primaryBtn} onClick={() => onSave(notes, dueDate, workWeek)} disabled={pending}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyTodosClient({ todos, myTasks }: { todos: PersonalTodo[]; myTasks: Task[] }) {
  const router = useRouter()
  const [newTitle, setNewTitle] = useState('')
  const [newWeek, setNewWeek] = useState('')
  const [adding, startAdd] = useTransition()
  const [showPortModal, setShowPortModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({})

  const open = todos.filter((t) => !(optimisticDone[t.id] ?? t.done))
  const done = todos.filter((t) => (optimisticDone[t.id] ?? t.done))

  const portableTasks = useMemo(
    () => myTasks.filter((t) => !todos.some((td) => td.linked_task_id === t.id)),
    [myTasks, todos],
  )

  function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    const work_week_start = newWeek || null
    setNewTitle('')
    startAdd(async () => { await addPersonalTodo({ title, work_week_start }); router.refresh() })
  }

  function handleToggle(todo: PersonalTodo) {
    const next = !(optimisticDone[todo.id] ?? todo.done)
    setOptimisticDone((s) => ({ ...s, [todo.id]: next }))
    startTransition(async () => {
      try { await togglePersonalTodo(todo.id, next); router.refresh() }
      catch (err) { alertError(err); setOptimisticDone((s) => ({ ...s, [todo.id]: todo.done })) }
    })
  }

  function handlePortIn(taskId: string) {
    startTransition(async () => { await portTaskIn(taskId); router.refresh() })
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this item?')) return
    startTransition(async () => { await deletePersonalTodo(id); router.refresh() })
  }

  function handleUnlink(id: string) {
    startTransition(async () => { await unlinkPersonalTodo(id); router.refresh() })
  }

  function handleSaveDetails(id: string, notes: string, dueDate: string, workWeek: string) {
    startTransition(async () => {
      await updatePersonalTodo(id, {
        notes: notes || null,
        due_date: dueDate || null,
        work_week_start: workWeek || null,
      })
      setExpandedId(null)
      router.refresh()
    })
  }

  function rowProps(todo: PersonalTodo) {
    return {
      todo,
      isDone: optimisticDone[todo.id] ?? todo.done,
      expanded: expandedId === todo.id,
      pending,
      onToggle: () => handleToggle(todo),
      onToggleExpand: () => setExpandedId((cur) => (cur === todo.id ? null : todo.id)),
      onDelete: () => handleDelete(todo.id),
      onUnlink: () => handleUnlink(todo.id),
      onSave: (notes: string, dueDate: string, workWeek: string) => handleSaveDetails(todo.id, notes, dueDate, workWeek),
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Personal To-Do List</div>
            <WikiButton sectionKey="myTodos" />
          </div>
          <div className={styles.pageSub}>{open.length} open item{open.length !== 1 ? 's' : ''}</div>
        </div>
        {myTasks.length > 0 && (
          <button className={styles.ghostBtn} onClick={() => setShowPortModal(true)}>Port in a task</button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="Add a personal to-do…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <select
            className={styles.input}
            value={newWeek}
            onChange={(e) => setNewWeek(e.target.value)}
            title="Assigning a work week adds this item to that week's update"
            style={{ maxWidth: '15rem' }}
          >
            <option value="">Not in a work week</option>
            {WEEK_OPTIONS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={handleAdd} disabled={adding || !newTitle.trim()}>
            {adding ? <Spinner size={14} className="spinnerOnPrimary" /> : 'Add'}
          </button>
        </div>

        {todos.length === 0 ? (
          <div className={styles.empty}>
            Nothing here yet. Add a quick item above, or port in a task assigned to you — checking either
            one off keeps the Tasks board in sync automatically. Give an item a work week and it also
            appears in that week&apos;s update.
          </div>
        ) : (
          <>
            <div className={styles.list}>{open.map((t) => <TodoRow key={t.id} {...rowProps(t)} />)}</div>
            {done.length > 0 && (
              <details className={styles.doneGroup}>
                <summary className={styles.doneSummary}>Completed ({done.length})</summary>
                <div className={styles.list}>{done.map((t) => <TodoRow key={t.id} {...rowProps(t)} />)}</div>
              </details>
            )}
          </>
        )}
      </div>

      {showPortModal && (
        <div className={styles.overlay} onMouseDown={() => setShowPortModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Port in a task</h2>
              <button className={styles.closeBtn} onClick={() => setShowPortModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              {portableTasks.length === 0 ? (
                <div className={styles.emptySmall}>All your tasks are already on this list.</div>
              ) : (
                <div className={styles.pickerList}>
                  {portableTasks.map((t) => (
                    <button key={t.id} className={styles.pickerRow} onClick={() => { handlePortIn(t.id); setShowPortModal(false) }} disabled={pending}>
                      <span className={styles.pickerTitle}>{t.title}</span>
                      <span className={styles.pickerStatus}>{t.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
