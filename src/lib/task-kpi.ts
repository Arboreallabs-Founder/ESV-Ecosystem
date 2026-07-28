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

/** DATE columns carry no time — treat the deadline as the end of that calendar day. */
export function endOfDay(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
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
      if (deadline && now > endOfDay(deadline)) k.notCompleted++
      else k.pending++
    }
  }
  return k
}
