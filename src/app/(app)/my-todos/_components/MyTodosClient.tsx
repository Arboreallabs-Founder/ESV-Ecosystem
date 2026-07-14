'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addPersonalTodo, updatePersonalTodo, deletePersonalTodo, togglePersonalTodo, portTaskIn, unlinkPersonalTodo,
} from '@/app/actions/personal-todos'
import type { PersonalTodo, Task } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../my-todos.module.css'

function formatDue(dateStr: string) {
  const d = new Date(dateStr)
  const isOverdue = d < new Date(new Date().toDateString())
  return { label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), isOverdue }
}

function TodoRow({ todo, isDone, expanded, pending, onToggle, onToggleExpand, onDelete, onUnlink, onSave }: {
  todo: PersonalTodo; isDone: boolean; expanded: boolean; pending: boolean
  onToggle: () => void; onToggleExpand: () => void; onDelete: () => void; onUnlink: () => void
  onSave: (notes: string, dueDate: string) => void
}) {
  const [notes, setNotes] = useState(todo.notes ?? '')
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const due = todo.due_date ? formatDue(todo.due_date) : null

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <button className={`${styles.checkbox} ${isDone ? styles.checkboxDone : ''}`} onClick={onToggle} aria-label="Toggle done">
          {isDone && '✓'}
        </button>
        <div className={styles.rowBody}>
          <div className={`${styles.rowTitle} ${isDone ? styles.rowTitleDone : ''}`}>{todo.title}</div>
          {(todo.notes || due || todo.linked_task) && (
            <div className={styles.rowMeta}>
              {todo.linked_task && <span className={styles.linkedChip}>Linked · {todo.linked_task.status}</span>}
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
            {todo.linked_task_id && <button className={styles.ghostBtn} onClick={onUnlink}>Unlink from task</button>}
            <div style={{ flex: 1 }} />
            <button className={styles.ghostBtn} onClick={onToggleExpand} disabled={pending}>Cancel</button>
            <button className={styles.primaryBtn} onClick={() => onSave(notes, dueDate)} disabled={pending}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyTodosClient({ todos, myTasks }: { todos: PersonalTodo[]; myTasks: Task[] }) {
  const router = useRouter()
  const [newTitle, setNewTitle] = useState('')
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
    setNewTitle('')
    startAdd(async () => { await addPersonalTodo({ title }); router.refresh() })
  }

  function handleToggle(todo: PersonalTodo) {
    const next = !(optimisticDone[todo.id] ?? todo.done)
    setOptimisticDone((s) => ({ ...s, [todo.id]: next }))
    startTransition(async () => {
      try { await togglePersonalTodo(todo.id, next); router.refresh() }
      catch (e) { alert((e as Error).message); setOptimisticDone((s) => ({ ...s, [todo.id]: todo.done })) }
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

  function handleSaveDetails(id: string, notes: string, dueDate: string) {
    startTransition(async () => {
      await updatePersonalTodo(id, { notes: notes || null, due_date: dueDate || null })
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
      onSave: (notes: string, dueDate: string) => handleSaveDetails(todo.id, notes, dueDate),
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>My To-Dos</div>
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
          <button className={styles.primaryBtn} onClick={handleAdd} disabled={adding || !newTitle.trim()}>
            {adding ? <Spinner size={14} className="spinnerOnPrimary" /> : 'Add'}
          </button>
        </div>

        {todos.length === 0 ? (
          <div className={styles.empty}>
            Nothing here yet. Add a quick item above, or port in a task assigned to you — checking either
            one off keeps the Tasks board in sync automatically.
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
