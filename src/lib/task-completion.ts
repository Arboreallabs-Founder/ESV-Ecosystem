/**
 * Rules for logging finished work on a task: the status and completed_at that go into the insert.
 *
 * - status 'Done' with no date → completed now.
 * - completed_at may be a date (YYYY-MM-DD, taken as midday India time so it never slides to the
 *   neighbouring day) or a full ISO timestamp. Future dates are refused: you can backdate work, not
 *   pre-date it.
 * - completed_at without status implies Done; completed_at with status 'To Do' is a contradiction.
 */

export type TaskCompletion = { status: 'To Do' | 'Done'; completed_at: string | null }

export class TaskCompletionError extends Error {}

/** Today's date in India, YYYY-MM-DD. */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function resolveTaskCompletion(
  status: string | null | undefined,
  completedAt: string | null | undefined,
  now = new Date(),
): TaskCompletion {
  const s = status?.trim() || null
  if (s && s !== 'To Do' && s !== 'Done') throw new TaskCompletionError("status must be 'To Do' or 'Done'.")
  const raw = completedAt?.trim() || null

  if (!raw) return s === 'Done' ? { status: 'Done', completed_at: now.toISOString() } : { status: 'To Do', completed_at: null }
  if (s === 'To Do') throw new TaskCompletionError("completed_at can only be set on a task that is 'Done'.")

  let iso: string
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00+05:30`)
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) throw new TaskCompletionError('completed_at is not a real date.')
    if (raw > todayInIndia(now)) throw new TaskCompletionError('completed_at cannot be in the future.')
    iso = d.toISOString()
  } else {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      throw new TaskCompletionError('completed_at must be a date (YYYY-MM-DD) or an ISO timestamp.')
    }
    // A minute of slack for clock skew between the assistant and us.
    if (d.getTime() > now.getTime() + 60_000) throw new TaskCompletionError('completed_at cannot be in the future.')
    iso = d.toISOString()
  }
  if (iso < '2000-01-01') throw new TaskCompletionError('completed_at is too far in the past.')
  return { status: 'Done', completed_at: iso }
}
