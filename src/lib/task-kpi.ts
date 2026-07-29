import type { Task } from './types'

/* Shared task-punctuality maths.
   Extracted from TaskKpiView so /tasks/kpi and /analytics compute identically — if these two
   pages ever disagreed about someone's on-time count, neither would be trusted. */

export type TaskKpis = {
  total: number
  done: number
  onTime: number
  pushed: number
  pending: number
  notCompleted: number
}

/**
 * End of the given calendar day, as a timestamp.
 *
 * DATE columns carry no time, so "due 29 July" means the *end* of 29 July — a task due today is
 * not late today, only once that day has fully passed.
 *
 * Pinned to IST rather than the viewer's local midnight, matching the rest of the app (see
 * src/lib/format-datetime.ts). Otherwise two colleagues in different timezones would disagree
 * about whether the same task is late. India has no DST, so +05:30 is constant year-round.
 */
export function endOfDay(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999+05:30`).getTime()
}

/** True only once the due day has fully passed — something due today is never overdue today. */
export function isPastDue(dateStr: string, now: number = Date.now()): boolean {
  return now > endOfDay(dateStr)
}

export function computeKpis(tasks: Task[]): TaskKpis {
  const now = Date.now()
  const k: TaskKpis = { total: tasks.length, done: 0, onTime: 0, pushed: 0, pending: 0, notCompleted: 0 }

  for (const t of tasks) {
    if (t.pushed_at) k.pushed++

    const isDone = t.status === 'Done'
    const deadline = t.pushed_date ?? t.due_date

    if (isDone) {
      k.done++
      // On time = completed on/before the original due date (legacy Done with no stamp counts as on time).
      if (!t.due_date || !t.completed_at || new Date(t.completed_at).getTime() <= endOfDay(t.due_date)) {
        k.onTime++
      }
    } else {
      // Open tasks: past the effective deadline → not completed; otherwise pending.
      if (deadline && isPastDue(deadline, now)) k.notCompleted++
      else k.pending++
    }
  }
  return k
}
