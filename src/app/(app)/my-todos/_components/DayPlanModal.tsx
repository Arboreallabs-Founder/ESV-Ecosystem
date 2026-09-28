'use client'

import { useMemo, useState, useTransition } from 'react'
import { saveDayPlan } from '@/app/actions/day-plans'
import type { DayPlan, DayPlanKind, PersonalTodo, Task } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { describeError } from '@/lib/client-errors'
import styles from '../my-todos.module.css'

/* Plan the day, or wrap it up.
 *
 * One textarea, one line per to-do — the same gesture as the Google Keep note this replaces. The
 * lines become real personal_todos carrying plan_date, so planning is filling the list rather
 * than keeping a second copy of it that has to be transcribed later. */

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function longDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function DayPlanModal({ kind, plans, todayIso, weekOptions, myTasks, todos, onClose, onSaved }: {
  kind: DayPlanKind
  plans: DayPlan[]
  todayIso: string
  weekOptions: Array<{ key: string; label: string }>
  /** Tasks assigned to you, for the "already on your plate" picker below. */
  myTasks: Task[]
  /** Your personal to-dos, same reason. */
  todos: PersonalTodo[]
  onClose: () => void
  onSaved: () => void
}) {
  // A morning plan is for today; an evening wrap plans tomorrow. That is the whole difference
  // between the two, so it is computed once here rather than branched all the way down.
  const planDate = kind === 'morning' ? todayIso : addDays(todayIso, 1)
  const existing = useMemo(
    () => plans.find((p) => p.kind === kind && p.plan_date === planDate) ?? null,
    [plans, kind, planDate],
  )

  // What's already yours, offered instead of retyping it: open Tasks, and open top-level to-dos
  // not already filed under this exact date. A to-do already mirroring a Task (linked_task_id) is
  // left out here — it would otherwise show up twice, once under each list.
  const openTasks = useMemo(() => myTasks.filter((t) => t.status !== 'Done'), [myTasks])
  const openTodos = useMemo(
    () => todos.filter((t) => !t.done && !t.parent_id && !t.linked_task_id && t.plan_date !== planDate),
    [todos, planDate],
  )

  const [note, setNote] = useState(existing?.note ?? '')
  const [lines, setLines] = useState('')
  const [week, setWeek] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const items = lines.split('\n').map((l) => l.trim()).filter(Boolean)
  const pickedCount = selectedTaskIds.size + selectedTodoIds.size

  function toggleTask(id: string) {
    setSelectedTaskIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleTodo(id: string) {
    setSelectedTodoIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function submit() {
    setError(null)
    if (!note.trim() && items.length === 0 && pickedCount === 0) {
      setError('Add at least one line, pick something from your list, or write a note.')
      return
    }
    startTransition(async () => {
      try {
        await saveDayPlan({
          kind, plan_date: planDate, note, items, work_week_start: week || null,
          task_ids: [...selectedTaskIds],
          existing_todo_ids: [...selectedTodoIds],
        })
        onSaved()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  const isMorning = kind === 'morning'

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h2 className={styles.modalTitle}>{isMorning ? 'Plan for today' : 'End of day'}</h2>
            <div className={styles.modalSub}>
              {isMorning
                ? `What you intend to do — ${longDate(planDate)}`
                : `How today went, and what tomorrow looks like — items land on ${longDate(planDate)}`}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* Said plainly, at the point of writing. This surface is read by founders and admins,
              unlike the rest of the personal list, and a page that looks private but is not
              would be worse than one that is simply honest about it. */}
          <div className={styles.visibilityNote}>
            Daily plans are visible to founders and admins. Items you add here become to-dos on your
            own list.
          </div>

          {(openTasks.length > 0 || openTodos.length > 0) && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Already on your plate</label>
              <div className={styles.planPickList}>
                {openTasks.map((t) => {
                  const on = selectedTaskIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.planPickRow} ${on ? styles.planPickRowOn : ''}`}
                      onClick={() => toggleTask(t.id)}
                    >
                      <span className={`${styles.planPickBox} ${on ? styles.planPickBoxOn : ''}`}>{on && '✓'}</span>
                      <span className={styles.planPickTitle}>{t.title}</span>
                      <span className={styles.planPickKind}>Task</span>
                    </button>
                  )
                })}
                {openTodos.map((t) => {
                  const on = selectedTodoIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.planPickRow} ${on ? styles.planPickRowOn : ''}`}
                      onClick={() => toggleTodo(t.id)}
                    >
                      <span className={`${styles.planPickBox} ${on ? styles.planPickBoxOn : ''}`}>{on && '✓'}</span>
                      <span className={styles.planPickTitle}>{t.title}</span>
                      <span className={styles.planPickKind}>To-do</span>
                    </button>
                  )
                })}
              </div>
              <div className={styles.fieldHint}>
                {pickedCount === 0
                  ? `Tap anything already assigned to you or already on your list to add it to ${isMorning ? "today's" : "tomorrow's"} plan.`
                  : `${pickedCount} picked.`}
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {isMorning ? 'Anything else you\'re doing today?' : 'Anything else for tomorrow?'}
            </label>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder={'One per line…\nKyoora — chase Alteria\nFinish SGP onboarding'}
              value={lines}
              onChange={(e) => setLines(e.target.value)}
            />
            <div className={styles.fieldHint}>
              {items.length === 0
                ? 'One to-do per line. Blank lines are ignored.'
                : `${items.length} to-do${items.length === 1 ? '' : 's'} will be added to your list.`}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{isMorning ? 'Anything to flag?' : 'How did today go?'}</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder={isMorning ? 'Optional — blockers, context, what matters most…' : 'Optional — what moved, what stalled…'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {items.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Also file these into a work week</label>
              <select className={styles.input} value={week} onChange={(e) => setWeek(e.target.value)}>
                <option value="">Not in a work week</option>
                {weekOptions.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
              </select>
              <div className={styles.fieldHint}>Optional — this is what puts them in the weekly update too.</div>
            </div>
          )}

          {existing && (
            <div className={styles.fieldHint}>
              You already filed this one. Saving updates the note; the lines above are added on top of
              what is already on your list.
            </div>
          )}

          {error && <div className={styles.errBox}>{error}</div>}
        </div>

        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span>
              : existing ? 'Update' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
