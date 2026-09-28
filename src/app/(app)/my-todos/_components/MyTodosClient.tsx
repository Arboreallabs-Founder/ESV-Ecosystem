'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  addPersonalTodo, updatePersonalTodo, deletePersonalTodo, togglePersonalTodo, portTaskIn, unlinkPersonalTodo,
} from '@/app/actions/personal-todos'
import type { DayPlan, MentionedTodo, PersonalTodo, Task, UserRow } from '@/lib/types'
import { isPastDue } from '@/lib/task-kpi'
import { weekRange } from '@/lib/week'
import { mentionedUsers, nestTodos, todoStamp } from '@/lib/todo-tree'
import Spinner from '@/app/_components/Spinner'
import Avatar from '@/app/_components/Avatar'
import { WikiButton } from '@/app/_components/WikiPanel'
import DayPlanModal from './DayPlanModal'
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

// The chip's job is to flag that an item has left the private list and is filed somewhere — that's
// only news when the "somewhere" isn't the week you're already looking at by default. Repeating
// "Week of ... (this week)" on nearly every card just because it's the common case is noise.
const THIS_WEEK_KEY = weekRange(0).key

function formatDue(dateStr: string) {
  // Same rule as the task board: overdue only after the due day has fully passed.
  return {
    label: new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    isOverdue: isPastDue(dateStr),
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A title with "@Name" spans picked out as tags — each with the mentioned person's photo, Slack-
 * style — matched against who was actually @mentioned (`users`) rather than a guess at capitalised
 * words, so it only lights up real mentions and knows whose face to show.
 */
function MentionedText({ text, users }: { text: string; users: Array<{ name: string; photoUrl: string | null }> }) {
  if (users.length === 0) return <>{text}</>
  const byName = new Map(users.map((u) => [u.name, u]))
  // Longest name first, so "Dale" can't steal the match that "Dale Galbano" should get.
  const pattern = new RegExp(`@(${[...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`, 'g')
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const user = byName.get(match[1])
    parts.push(
      <span key={match.index} className={styles.mentionTag}>
        <Avatar name={user?.name} photoUrl={user?.photoUrl} size="xs" />
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function SubtaskRow({ todo, isDone, pending, onToggle, onDelete }: {
  todo: PersonalTodo; isDone: boolean; pending: boolean; onToggle: () => void; onDelete: () => void
}) {
  // The timestamp is the point of a sub-task here: when it was ticked, or when it was added if it
  // has not been. Both read off columns that already existed.
  const stamp = todoStamp(todo)
  return (
    <div className={styles.subRow}>
      <button
        className={`${styles.subCheckbox} ${isDone ? styles.checkboxDone : ''}`}
        onClick={onToggle}
        disabled={pending}
        aria-label={`Toggle ${todo.title}`}
      >
        {isDone && '✓'}
      </button>
      <span className={`${styles.subTitle} ${isDone ? styles.rowTitleDone : ''}`}>
        <MentionedText text={todo.title} users={mentionedUsers(todo)} />
      </span>
      {stamp && <span className={styles.subStamp} title={isDone ? 'Completed' : 'Added'}>{stamp}</span>}
      <button className={styles.subDelete} onClick={onDelete} title="Remove" disabled={pending}>×</button>
    </div>
  )
}

/** Finds the "@word" the cursor is currently inside, if any — start of the '@' must be at the
    start of the text or after whitespace, and nothing between it and the cursor may be whitespace. */
function activeMention(text: string, cursor: number): { start: number; query: string } | null {
  const upToCursor = text.slice(0, cursor)
  const at = upToCursor.lastIndexOf('@')
  if (at === -1) return null
  if (at > 0 && !/\s/.test(text[at - 1])) return null
  const query = upToCursor.slice(at + 1)
  if (/\s/.test(query)) return null
  return { start: at, query }
}

/**
 * A sub-task's text input, with @mention autocomplete. Only a name picked from the dropdown
 * becomes a real mention (recorded by id, notifies that person, and gives them read-only access
 * to this one row) — typing "@someone" without selecting them is just text, same as anywhere else.
 */
function SubtaskInput({ mentionableUsers, onSubmit, onCancel }: {
  mentionableUsers: UserRow[]
  onSubmit: (title: string, mentionedUserIds: string[]) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  // Viewport coordinates for the portal below — recomputed whenever the mention opens. The dropdown
  // can't be positioned relative to this input in the normal DOM flow: the input sits inside a
  // to-do card that clips overflow for its rounded corners, and that clipping would cut the
  // dropdown off along with anything else that tried to float past the card's edge.
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!mention || !inputRef.current) { setDropdownPos(null); return }
    const reposition = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
    reposition()
    // The card body scrolls independently of the page (see .cardBody elsewhere in this app), so a
    // plain window scroll listener wouldn't be enough — capture:true catches scroll on any
    // ancestor, not just window.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [mention])

  // Ranked, not just filtered: a name starting with what's typed is the "most relevant person" —
  // it belongs above someone who merely contains the query somewhere in the middle of their name.
  const suggestions = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return mentionableUsers
      .map((u) => ({ u, name: (u.name || u.email).toLowerCase() }))
      .filter(({ name }) => name.includes(q))
      .sort((a, b) => {
        const rank = (n: string) => (n.startsWith(q) ? 0 : 1)
        return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)
      })
      .slice(0, 6)
      .map(({ u }) => u)
  }, [mention, mentionableUsers])

  function pickUser(u: UserRow) {
    if (!mention) return
    const cursor = inputRef.current?.selectionStart ?? value.length
    const name = u.name || u.email
    const before = value.slice(0, mention.start)
    const after = value.slice(cursor)
    setValue(`${before}@${name} ${after}`)
    setMentionedIds((ids) => (ids.includes(u.id) ? ids : [...ids, u.id]))
    setMention(null)
    const pos = before.length + name.length + 2
    // The input re-renders with the new value first; grabbing focus in the same tick would race it.
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos))
  }

  function submit() {
    const title = value.trim()
    if (title) onSubmit(title, mentionedIds)
    else onCancel()
  }

  return (
    <div className={styles.subInputWrap}>
      <input
        ref={inputRef}
        className={styles.subInput}
        autoFocus
        placeholder="Sub-task… (@ to mention someone)"
        value={value}
        onChange={(e) => {
          const text = e.target.value
          setValue(text)
          setMention(activeMention(text, e.target.selectionStart ?? text.length))
          setActiveIndex(0)
        }}
        onKeyDown={(e) => {
          if (mention && suggestions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickUser(suggestions[activeIndex]); return }
            if (e.key === 'Escape') { e.preventDefault(); setMention(null); return }
          }
          if (e.key === 'Enter') submit()
          // Escape abandons the line rather than committing a half-typed one.
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={submit}
      />
      {/* Portaled to <body>, not rendered in place: the to-do card this input lives in clips
          overflow for its rounded corners, which would clip the dropdown too if it stayed in the
          normal DOM flow here. onMouseDown + preventDefault (not onClick) keeps focus on the input
          so picking a name doesn't fire the blur-submit above before the mention is inserted —
          same trick this app's modals use to survive a drag-release landing outside them. */}
      {mention && suggestions.length > 0 && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div className={styles.mentionDropdown} style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={`${styles.mentionOption} ${i === activeIndex ? styles.mentionOptionActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pickUser(u) }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {/* The top match — ranked "most relevant" above — gets a slightly larger photo, the
                  same way a search box makes its best guess visually heavier than the rest. */}
              <Avatar name={u.name} email={u.email} photoUrl={u.photo_url} size={i === 0 ? 'md' : 'sm'} />
              <span className={styles.mentionText}>
                <span className={styles.mentionName}>{u.name || u.email}</span>
                {u.designation && <span className={styles.mentionRole}>{u.designation}</span>}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function TodoRow({
  todo, isDone, expanded, pending, doneOf, mentionableUsers,
  onToggle, onToggleExpand, onDelete, onUnlink, onSave, onToggleChild, onDeleteChild, onAddChild,
}: {
  todo: PersonalTodo; isDone: boolean; expanded: boolean; pending: boolean
  doneOf: (t: PersonalTodo) => boolean
  mentionableUsers: UserRow[]
  onToggle: () => void; onToggleExpand: () => void; onDelete: () => void; onUnlink: () => void
  onSave: (notes: string, dueDate: string, workWeek: string) => void
  onToggleChild: (child: PersonalTodo) => void
  onDeleteChild: (id: string) => void
  onAddChild: (title: string, mentionedUserIds: string[]) => void
}) {
  const [notes, setNotes] = useState(todo.notes ?? '')
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const [workWeek, setWorkWeek] = useState(todo.work_week_start ?? '')
  const [addingChild, setAddingChild] = useState(false)
  const due = todo.due_date ? formatDue(todo.due_date) : null
  // A week outside the offered range (an old item) still deserves a readable chip. The current
  // week is the default everything lands in, so it's suppressed rather than repeated on every card.
  const weekLabel = todo.work_week_start && todo.work_week_start !== THIS_WEEK_KEY
    ? WEEK_LABELS.get(todo.work_week_start) ?? todo.work_week_start
    : null
  const children = todo.children ?? []
  // Counted off the live optimistic state so ticking a sub-task moves the counter immediately,
  // rather than after the server round trip.
  const progress = children.length > 0
    ? { done: children.filter(doneOf).length, total: children.length }
    : null

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <button className={`${styles.checkbox} ${isDone ? styles.checkboxDone : ''}`} onClick={onToggle} aria-label="Toggle done">
          {isDone && '✓'}
        </button>
        <div className={styles.rowBody}>
          <div className={`${styles.rowTitle} ${isDone ? styles.rowTitleDone : ''}`}>{todo.title}</div>
          {(todo.notes || due || todo.linked_task || weekLabel || progress) && (
            <div className={styles.rowMeta}>
              {progress && (
                <span
                  className={`${styles.progressChip} ${progress.done === progress.total ? styles.progressChipFull : ''}`}
                  title="Sub-tasks completed"
                >
                  {progress.done}/{progress.total}
                </span>
              )}
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

      {(children.length > 0 || addingChild) && (
        <div className={styles.subList}>
          {children.map((c) => (
            <SubtaskRow
              key={c.id}
              todo={c}
              isDone={doneOf(c)}
              pending={pending}
              onToggle={() => onToggleChild(c)}
              onDelete={() => onDeleteChild(c.id)}
            />
          ))}
          {addingChild && (
            <SubtaskInput
              mentionableUsers={mentionableUsers}
              onSubmit={(title, mentionedUserIds) => { setAddingChild(false); onAddChild(title, mentionedUserIds) }}
              onCancel={() => setAddingChild(false)}
            />
          )}
        </div>
      )}

      {/* Offered only on open items: adding a sub-task to something already ticked off is a way
          to make a completed item silently incomplete again. */}
      {!addingChild && !isDone && (
        <button className={styles.addSubBtn} onClick={() => setAddingChild(true)}>+ Sub-task</button>
      )}

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

export default function MyTodosClient({ todos, myTasks, dayPlans, mentions, mentionableUsers, todayIso }: {
  todos: PersonalTodo[]; myTasks: Task[]; dayPlans: DayPlan[]
  /** Sub-tasks someone else @mentioned you on — read-only, live on their list, not yours. */
  mentions: MentionedTodo[]
  /** Everyone the @mention picker can offer, already excluding yourself. */
  mentionableUsers: UserRow[]
  todayIso: string
}) {
  const router = useRouter()
  const [newTitle, setNewTitle] = useState('')
  const [newWeek, setNewWeek] = useState('')
  const [adding, startAdd] = useTransition()
  const [showPortModal, setShowPortModal] = useState(false)
  const [planKind, setPlanKind] = useState<'morning' | 'evening' | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({})

  const doneOf = (t: PersonalTodo) => optimisticDone[t.id] ?? t.done

  // Nest first, then split — so a parent stays with its children and an open parent is not
  // separated from a completed sub-task sitting under it.
  const tree = useMemo(() => nestTodos(todos), [todos])
  const open = tree.filter((t) => !doneOf(t))
  const done = tree.filter((t) => doneOf(t))

  const portableTasks = useMemo(
    () => myTasks.filter((t) => !todos.some((td) => td.linked_task_id === t.id)),
    [myTasks, todos],
  )

  // Today's entries, so the buttons read "Edit" once something has been filed rather than
  // inviting a second one that would just overwrite the first.
  const todayMorning = dayPlans.find((p) => p.plan_date === todayIso && p.kind === 'morning')
  const plannedToday = todos.filter((t) => t.plan_date === todayIso && !t.parent_id)

  function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    const work_week_start = newWeek || null
    setNewTitle('')
    startAdd(async () => { await addPersonalTodo({ title, work_week_start }); router.refresh() })
  }

  function handleToggle(todo: PersonalTodo) {
    const next = !doneOf(todo)
    setOptimisticDone((s) => ({ ...s, [todo.id]: next }))
    startTransition(async () => {
      try { await togglePersonalTodo(todo.id, next); router.refresh() }
      catch (err) { alertError(err); setOptimisticDone((s) => ({ ...s, [todo.id]: todo.done })) }
    })
  }

  function handleAddChild(parentId: string, title: string, mentionedUserIds: string[]) {
    startTransition(async () => {
      try { await addPersonalTodo({ title, parent_id: parentId, mentioned_user_ids: mentionedUserIds }); router.refresh() }
      catch (err) { alertError(err) }
    })
  }

  function handlePortIn(taskId: string) {
    startTransition(async () => { await portTaskIn(taskId); router.refresh() })
  }

  function handleDelete(todo: PersonalTodo) {
    const kids = todo.children?.length ?? 0
    const message = kids > 0
      ? `Remove this item and its ${kids} sub-task${kids === 1 ? '' : 's'}?`
      : 'Remove this item?'
    if (!confirm(message)) return
    startTransition(async () => { await deletePersonalTodo(todo.id); router.refresh() })
  }

  function handleDeleteChild(id: string) {
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
      isDone: doneOf(todo),
      expanded: expandedId === todo.id,
      pending,
      doneOf,
      mentionableUsers,
      onToggle: () => handleToggle(todo),
      onToggleExpand: () => setExpandedId((cur) => (cur === todo.id ? null : todo.id)),
      onDelete: () => handleDelete(todo),
      onUnlink: () => handleUnlink(todo.id),
      onSave: (notes: string, dueDate: string, workWeek: string) => handleSaveDetails(todo.id, notes, dueDate, workWeek),
      onToggleChild: (child: PersonalTodo) => handleToggle(child),
      onDeleteChild: handleDeleteChild,
      onAddChild: (title: string, mentionedUserIds: string[]) => handleAddChild(todo.id, title, mentionedUserIds),
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
          <div className={styles.pageSub}>
            {open.length} open item{open.length !== 1 ? 's' : ''}
            {plannedToday.length > 0 && <> · {plannedToday.length} planned for today</>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.ghostBtn} onClick={() => setPlanKind('morning')}>
            {todayMorning ? "Edit today's plan" : 'Plan my day'}
          </button>
          <button className={styles.ghostBtn} onClick={() => setPlanKind('evening')}>End of day</button>
          {myTasks.length > 0 && (
            <button className={styles.ghostBtn} onClick={() => setShowPortModal(true)}>Port in a task</button>
          )}
        </div>
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

        {/* Someone else's sub-task, surfaced here because they @mentioned you on it. Read-only —
            it lives on their list, not yours — so no checkbox, no delete, no edit. */}
        {mentions.length > 0 && (
          <div className={styles.mentionsSection}>
            <div className={styles.mentionsHead}>
              <span className={styles.mentionsTitle}>Mentioned you</span>
              <span className={styles.mentionsCount}>{mentions.length}</span>
            </div>
            <div className={styles.list}>
              {mentions.map((m) => {
                const stamp = todoStamp(m)
                return (
                  <div key={m.id} className={styles.mentionCard}>
                    <span className={`${styles.mentionDot} ${m.done ? styles.mentionDotDone : ''}`} aria-hidden="true">
                      {m.done && '✓'}
                    </span>
                    <div className={styles.mentionBody}>
                      <div className={`${styles.mentionTitle} ${m.done ? styles.rowTitleDone : ''}`}>{m.title}</div>
                      <div className={styles.mentionMeta}>
                        On {m.owner?.name || m.owner?.email || 'someone'}&apos;s list
                        {stamp && <> · {stamp}</>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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

      {planKind && (
        <DayPlanModal
          kind={planKind}
          plans={dayPlans}
          todayIso={todayIso}
          weekOptions={WEEK_OPTIONS}
          myTasks={myTasks}
          todos={todos}
          onClose={() => setPlanKind(null)}
          onSaved={() => { setPlanKind(null); router.refresh() }}
        />
      )}

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
