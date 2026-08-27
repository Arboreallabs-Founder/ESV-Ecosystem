'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { deriveLinesFromRecords } from '@/lib/attendance'
import type { AttendanceLineType, AttendanceStatus } from '@/lib/types'

/**
 * Attendance statement actions. The state machine lives here rather than in RLS, because RLS can
 * say "this person may write this row" but not "sent may become approved but locked may not".
 *
 *   draft → sent → approved            → locked
 *                ↘ disputed → sent ↗
 *
 * Approval is required but deliberately NOT blocking: a statement can be locked for payroll while
 * still unapproved, and when that happens it is recorded rather than glossed over.
 */

// Same three roles that already decide leave requests — attendance is the same kind of decision
// about the same people, so it should not have a different answer to "who is a lead".
async function requireManager() {
  return requireRole(['founder', 'admin', 'hr'])
}

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

/** States in which HR may still change the contents. */
const EDITABLE: AttendanceStatus[] = ['draft', 'disputed']

function revalidate() {
  revalidatePath('/attendance')
  revalidatePath('/hr')
}

// ── Creating and filling ─────────────────────────────────────────────────────

/** Open (or reopen) a month for one employee. Idempotent — returns the existing one if present. */
export async function openStatement(userId: string, period: string): Promise<string> {
  const { supabase, orgId } = await requireManager()

  const { data: existing } = await supabase
    .from('attendance_statements')
    .select('id')
    .eq('user_id', userId)
    .eq('period_month', period)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data, error } = await supabase
    .from('attendance_statements')
    .insert({ org_id: orgId, user_id: userId, period_month: period })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)
  revalidate()
  return data.id as string
}

/** Open a month for everyone who does not have one yet. */
export async function openMonthForAll(userIds: string[], period: string): Promise<number> {
  const { supabase, orgId } = await requireManager()

  const { data: have } = await supabase
    .from('attendance_statements')
    .select('user_id')
    .eq('period_month', period)
  const already = new Set((have ?? []).map((r: any) => r.user_id))
  const missing = userIds.filter((id) => !already.has(id))
  if (missing.length === 0) return 0

  const { error } = await supabase
    .from('attendance_statements')
    .insert(missing.map((id) => ({ org_id: orgId, user_id: id, period_month: period })))
  if (error) throw dbFailure('save that', error)
  revalidate()
  return missing.length
}

/**
 * Replace the auto lines with a fresh read of the app's records.
 *
 * Only auto lines are touched — anything HR typed survives untouched, which is the whole reason
 * source is stored. Refused once a statement has been sent: re-deriving underneath an employee
 * who is looking at it would change what they are being asked to approve.
 */
export async function pullFromRecords(statementId: string): Promise<{ added: number }> {
  const { supabase, orgId, userId } = await requireManager()

  const { data: st, error: stErr } = await supabase
    .from('attendance_statements')
    .select('id, user_id, period_month, status')
    .eq('id', statementId)
    .single()
  if (stErr) throw stErr
  if (!EDITABLE.includes(st.status as AttendanceStatus)) {
    throw new UserFacingError('This statement has already been sent. Reopen it before pulling records again.')
  }

  const derived = await deriveLinesFromRecords(st.user_id as string, st.period_month as string)

  const { error: delErr } = await supabase
    .from('attendance_statement_lines')
    .delete()
    .eq('statement_id', statementId)
    .eq('source', 'auto')
  if (delErr) throw delErr

  if (derived.length > 0) {
    const { error: insErr } = await supabase.from('attendance_statement_lines').insert(
      derived.map((d) => ({
        org_id: orgId,
        statement_id: statementId,
        entry_date: d.entry_date,
        line_type: d.line_type,
        source: 'auto',
        detail: d.detail,
        leave_days: d.leave_days,
        created_by: userId,
      })),
    )
    if (insErr) throw dbFailure('save that', insErr)
  }

  revalidate()
  return { added: derived.length }
}

export async function addLine(statementId: string, input: {
  entry_date: string
  line_type: AttendanceLineType
  detail?: string | null
  leave_days?: number
}): Promise<void> {
  const { supabase, orgId, userId } = await requireManager()

  const { data: st, error: stErr } = await supabase
    .from('attendance_statements')
    .select('status').eq('id', statementId).single()
  if (stErr) throw stErr
  if (!EDITABLE.includes(st.status as AttendanceStatus)) {
    throw new UserFacingError('This statement has been sent. Reopen it to make changes.')
  }
  if (!input.entry_date) throw new UserFacingError('A date is required.')

  const { error } = await supabase.from('attendance_statement_lines').insert({
    org_id: orgId,
    statement_id: statementId,
    entry_date: input.entry_date,
    line_type: input.line_type,
    source: 'manual',
    detail: input.detail?.trim() || null,
    leave_days: input.leave_days ?? 0,
    created_by: userId,
  })
  if (error) throw dbFailure('save that', error)
  revalidate()
}

export async function deleteLine(lineId: string): Promise<void> {
  const { supabase } = await requireManager()
  const { data: line, error: lErr } = await supabase
    .from('attendance_statement_lines')
    .select('statement_id, statement:attendance_statements!statement_id(status)')
    .eq('id', lineId)
    .single()
  if (lErr) throw lErr
  const st = Array.isArray((line as any).statement) ? (line as any).statement[0] : (line as any).statement
  if (!EDITABLE.includes(st?.status as AttendanceStatus)) {
    throw new UserFacingError('This statement has been sent. Reopen it to make changes.')
  }
  const { error } = await supabase.from('attendance_statement_lines').delete().eq('id', lineId)
  if (error) throw dbFailure('save that', error)
  revalidate()
}

/** "Considered" on the sheet: keep the record, drop the charge. A reason is required. */
export async function setLineWaived(lineId: string, waived: boolean, reason: string): Promise<void> {
  const { supabase } = await requireManager()
  if (waived && !reason.trim()) throw new UserFacingError('Say why it is being waived — the reason is the record.')

  const { error } = await supabase
    .from('attendance_statement_lines')
    .update({ waived, waived_reason: waived ? reason.trim() : null })
    .eq('id', lineId)
  if (error) throw dbFailure('save that', error)
  revalidate()
}

export async function setStatementNotes(statementId: string, input: {
  deduction_note?: string | null
  hr_note?: string | null
}): Promise<void> {
  const { supabase } = await requireManager()
  const { error } = await supabase
    .from('attendance_statements')
    .update({
      deduction_note: input.deduction_note?.trim() || null,
      hr_note: input.hr_note?.trim() || null,
    })
    .eq('id', statementId)
  if (error) throw dbFailure('save that', error)
  revalidate()
}

// ── The state machine ────────────────────────────────────────────────────────

/**
 * Hand it to the employee. From here the contents are frozen until someone reopens it.
 *
 * Also raises a Task assigned to them. That is the notification as well as the to-do: the alerts
 * bell is fed by tasks assigned to you, so one write both tells them and keeps nagging until it is
 * answered. Without it people only find out by opening the page, which quietly recreates the
 * WhatsApp chase this feature exists to end.
 */
export async function sendStatement(statementId: string): Promise<void> {
  const { supabase, userId, orgId } = await requireManager()

  const { data, error } = await supabase
    .from('attendance_statements')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: userId,
      // A resend after a dispute starts the question fresh.
      approved_at: null,
      disputed_at: null,
      dispute_note: null,
    })
    .eq('id', statementId)
    .in('status', ['draft', 'disputed'])
    .select('id, user_id, period_month, task_id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('Only a draft or a disputed statement can be sent.')
  const st = data[0]

  // Non-fatal: the statement is sent either way. Failing the send because the notification failed
  // would be the wrong trade — the employee can still find it on the page.
  try {
    // A re-send replaces its task rather than stacking a second one on the same month.
    if (st.task_id) {
      await supabase.from('tasks').delete().eq('id', st.task_id).eq('status', 'To Do')
    }
    const month = new Date(`${st.period_month}T00:00:00`)
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title: `Approve your ${month} attendance`,
        description:
          'HR has sent your attendance statement for this month. Check it and either approve it '
          + 'or say what is wrong — payroll uses it either way, so a dispute needs to be raised '
          + 'before the month is locked.',
        assignee_id: st.user_id,
        assigned_by_id: userId,
        link_url: '/attendance',
        priority: 'High',
        status: 'To Do',
        created_by: userId,
        org_id: orgId,
      })
      .select('id')
      .single()
    if (task) {
      await supabase.from('attendance_statements').update({ task_id: task.id }).eq('id', statementId)
    }
  } catch (err) {
    console.error('[attendance] approval task could not be raised:', err)
  }

  revalidate()
  revalidatePath('/tasks')
}

/** Close the approval task once the employee has answered, so it stops nagging. */
async function closeApprovalTask(supabase: any, statementId: string) {
  try {
    const { data } = await supabase
      .from('attendance_statements').select('task_id').eq('id', statementId).single()
    if (data?.task_id) {
      await supabase
        .from('tasks')
        .update({ status: 'Done', completed_at: new Date().toISOString() })
        .eq('id', data.task_id)
        .neq('status', 'Done')
    }
  } catch (err) {
    console.error('[attendance] could not close the approval task:', err)
  }
}

/** Put a sent statement back into HR's hands so it can be corrected. */
export async function reopenStatement(statementId: string): Promise<void> {
  const { supabase } = await requireManager()
  const { data, error } = await supabase
    .from('attendance_statements')
    .update({ status: 'draft', approved_at: null, sent_at: null })
    .eq('id', statementId)
    // A locked statement is a payroll record; correcting it is a payroll decision, not a UI one.
    .in('status', ['sent', 'approved', 'disputed'])
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('A locked statement cannot be reopened here.')
  revalidate()
}

export async function approveStatement(statementId: string): Promise<void> {
  const { supabase, userId } = await requireInternal()

  // Scoped to the caller's own statement AND to the state where approval means something. An
  // employee cannot approve someone else's, and cannot approve a draft they should not have seen.
  const { data, error } = await supabase
    .from('attendance_statements')
    .update({ status: 'approved', approved_at: new Date().toISOString(), disputed_at: null, dispute_note: null })
    .eq('id', statementId)
    .eq('user_id', userId)
    .in('status', ['sent', 'disputed'])
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('This statement is not awaiting your approval.')
  await closeApprovalTask(supabase, statementId)
  revalidate()
  revalidatePath('/tasks')
}

export async function disputeStatement(statementId: string, note: string): Promise<void> {
  const { supabase, userId } = await requireInternal()
  const reason = note.trim()
  // The whole point of moving off WhatsApp is that a dispute is answerable. "Wrong" is not.
  if (reason.length < 5) throw new UserFacingError('Say what is wrong — which date, and what it should be.')

  const { data, error } = await supabase
    .from('attendance_statements')
    .update({ status: 'disputed', disputed_at: new Date().toISOString(), dispute_note: reason, approved_at: null })
    .eq('id', statementId)
    .eq('user_id', userId)
    .in('status', ['sent', 'approved'])
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('This statement is not open for a dispute.')
  // A dispute is an answer too — the task has served its purpose and should stop nagging.
  await closeApprovalTask(supabase, statementId)
  revalidate()
  revalidatePath('/tasks')
}

/** HR/founder records how a dispute was settled. Sending the corrected statement is separate. */
export async function resolveDispute(statementId: string, note: string): Promise<void> {
  const { supabase, userId } = await requireManager()
  if (!note.trim()) throw new UserFacingError('Record what was agreed.')

  const { data, error } = await supabase
    .from('attendance_statements')
    .update({ resolved_at: new Date().toISOString(), resolved_by: userId, resolution_note: note.trim() })
    .eq('id', statementId)
    .eq('status', 'disputed')
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('That statement is not under dispute.')
  revalidate()
}

/**
 * Payroll processed. Allowed without approval by design — approval is required but not blocking,
 * so one person on holiday cannot hold up the run. When it happens the statement says so, rather
 * than leaving a locked-but-unapproved record looking the same as an approved one.
 */
export async function lockStatement(statementId: string): Promise<void> {
  const { supabase, userId } = await requireManager()

  const { data: st, error: stErr } = await supabase
    .from('attendance_statements')
    .select('status').eq('id', statementId).single()
  if (stErr) throw stErr
  if (st.status === 'draft') throw new UserFacingError('Send the statement before locking it.')
  if (st.status === 'disputed') throw new UserFacingError('Settle the dispute before locking this month.')

  const { data, error } = await supabase
    .from('attendance_statements')
    .update({
      status: 'locked',
      locked_at: new Date().toISOString(),
      locked_by: userId,
      locked_without_approval: st.status !== 'approved',
    })
    .eq('id', statementId)
    .in('status', ['sent', 'approved'])
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data?.length) throw new UserFacingError('That statement could not be locked.')
  revalidate()
}
