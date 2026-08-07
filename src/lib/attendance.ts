import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AttendanceLine, AttendanceLineType, AttendanceStatement } from '@/lib/types'

// Re-exported so server callers have one import site; the definitions live in a module with
// no server dependencies so client components can use them too.
export { monthKey, monthLabel, recentMonths, totalLeaveDays, countByType } from './attendance-format'

/**
 * Monthly attendance statements — the app version of the sheet HR sends on WhatsApp.
 *
 * Reads only. Everything that writes goes through the server actions, which is where the state
 * machine (draft → sent → approved/disputed → locked) is enforced.
 */

const STATEMENT_SELECT = `
  id, user_id, period_month, status,
  sent_at, approved_at, disputed_at, dispute_note,
  resolved_at, resolution_note,
  locked_at, locked_without_approval,
  deduction_note, hr_note,
  user:users!user_id(name, photo_url),
  lines:attendance_statement_lines(id, statement_id, entry_date, line_type, source, detail, leave_days, waived, waived_reason)
`

function shape(row: any): AttendanceStatement {
  const user = Array.isArray(row.user) ? row.user[0] : row.user
  return {
    ...row,
    user: user ?? null,
    // Chronological, because a statement is read as a month, not as a set of categories.
    lines: ((row.lines ?? []) as AttendanceLine[])
      .slice()
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.line_type.localeCompare(b.line_type))
      .map((l) => ({ ...l, leave_days: Number(l.leave_days) })),
  }
}

/** Every statement for a month, for the HR management view. RLS scopes it. */
export const fetchStatementsForMonth = cache(async (period: string): Promise<AttendanceStatement[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_statements')
    .select(STATEMENT_SELECT)
    .eq('period_month', period)
  if (error) {
    // A failed read must not render as "nobody has a statement this month".
    console.error('[attendance] month read failed:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(shape).sort((a, b) =>
    (a.user?.name ?? '').localeCompare(b.user?.name ?? ''))
})

/** One person's own statements, newest first. RLS hides drafts from them. */
export const fetchMyStatements = cache(async (userId: string): Promise<AttendanceStatement[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_statements')
    .select(STATEMENT_SELECT)
    .eq('user_id', userId)
    .order('period_month', { ascending: false })
    .limit(12)
  if (error) {
    console.error('[attendance] own read failed:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(shape)
})

/** Statements still waiting on somebody, across every month — the chase list. */
export const fetchOpenStatements = cache(async (): Promise<AttendanceStatement[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_statements')
    .select(STATEMENT_SELECT)
    .in('status', ['sent', 'disputed'])
    .order('period_month', { ascending: false })
  if (error) {
    console.error('[attendance] open read failed:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(shape)
})

// ── Deriving what the app already knows ──────────────────────────────────────

export type DerivedLine = {
  entry_date: string
  line_type: AttendanceLineType
  detail: string | null
  leave_days: number
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  sick: 'Sick leave',
  my_day: 'My Day',
  compensatory: 'Compensatory off',
  unpaid: 'Unpaid leave',
  wfh: 'Work from home',
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * The lines the app can fill in for a person and month: approved leave, WFH, and events attended.
 *
 * The other columns on HR's sheet — late logins, missed punch-outs, half days, Saturday
 * attendance — have no source here. The clock widget only shows whether you are inside the
 * clock-in window; nothing records a punch. Those stay manual, and the UI says so rather than
 * leaving HR to wonder why they are empty.
 */
export async function deriveLinesFromRecords(userId: string, period: string): Promise<DerivedLine[]> {
  const supabase = await createClient()
  const start = period
  const endDate = new Date(`${period}T00:00:00`)
  endDate.setMonth(endDate.getMonth() + 1)
  endDate.setDate(0)
  const end = endDate.toISOString().slice(0, 10)

  const [leaveRes, eventRes] = await Promise.all([
    // Approved only. A pending request is not yet a fact about the month.
    supabase
      .from('leave_requests')
      .select('leave_type, start_date, end_date')
      .eq('requester_id', userId)
      .eq('status', 'approved')
      .lte('start_date', end)
      .gte('end_date', start),
    supabase
      .from('bulletin_event_attendees')
      .select('post:bulletin_posts!post_id(title, event_date)')
      .eq('user_id', userId),
  ])

  if (leaveRes.error) console.error('[attendance] leave derive failed:', leaveRes.error.message)
  if (eventRes.error) console.error('[attendance] event derive failed:', eventRes.error.message)

  const lines: DerivedLine[] = []

  for (const r of (leaveRes.data ?? []) as any[]) {
    for (const day of eachDate(r.start_date, r.end_date)) {
      // A request can straddle a month boundary; only the days inside this month belong here.
      if (day < start || day > end) continue
      const isWfh = r.leave_type === 'wfh'
      lines.push({
        entry_date: day,
        line_type: isWfh ? 'wfh' : 'leave',
        detail: LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type,
        // WFH is a working day, so it is recorded but never charged as leave.
        leave_days: isWfh ? 0 : 1,
      })
    }
  }

  for (const a of (eventRes.data ?? []) as any[]) {
    const post = Array.isArray(a.post) ? a.post[0] : a.post
    if (!post?.event_date || post.event_date < start || post.event_date > end) continue
    lines.push({
      entry_date: post.event_date,
      line_type: 'event',
      detail: post.title ?? null,
      leave_days: 0,
    })
  }

  return lines.sort((a, b) => a.entry_date.localeCompare(b.entry_date))
}
