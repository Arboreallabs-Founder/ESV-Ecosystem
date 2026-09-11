'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { notify, usersWithRoles } from '@/lib/notifications'
import type { LeaveType } from '@/lib/types'

const APPROVER_ROLES = ['founder', 'admin', 'hr']

async function requireRequester() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

async function requireApprover() {
  return requireRole(APPROVER_ROLES)
}

export type LeaveRequestInput = {
  leave_type: LeaveType
  start_date: string
  end_date: string
  /** Only valid when start_date === end_date; counts 0.5 against the balance. */
  is_half_day?: boolean
  reason?: string | null
}

export async function createLeaveRequest(input: LeaveRequestInput): Promise<void> {
  const { supabase, userId, orgId } = await requireRequester()
  if (!input.start_date || !input.end_date) throw new UserFacingError('Start and end dates are required.')
  if (input.end_date < input.start_date) throw new UserFacingError('End date cannot be before the start date.')
  if (input.is_half_day && input.start_date !== input.end_date) {
    throw new UserFacingError('A half day must start and end on the same date.')
  }

  const { error } = await supabase.from('leave_requests').insert({
    org_id: orgId,
    requester_id: userId,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    is_half_day: input.is_half_day ?? false,
    reason: input.reason?.trim() || null,
  })
  if (error) throw dbFailure('save that', error)

  // Approvers used to find out only by opening /approvals, which is how a request could sit for a
  // week without anyone having refused it.
  if (orgId) {
    const { data: requester } = await supabase.from('users').select('name').eq('id', userId).single()
    const span = input.start_date === input.end_date ? input.start_date : `${input.start_date} to ${input.end_date}`
    await notify(supabase, {
      orgId,
      userIds: await usersWithRoles(supabase, orgId, APPROVER_ROLES),
      actorId: userId,
      kind: 'leave_submitted',
      title: `${requester?.name ?? 'A team member'} requested leave`,
      body: `${input.leave_type}, ${span}`,
      link: '/approvals',
    })
  }

  revalidatePath('/hr')
  revalidatePath('/approvals')
}

export async function withdrawLeaveRequest(id: string): Promise<void> {
  const { supabase, userId } = await requireRequester()
  const { data: existing } = await supabase.from('leave_requests').select('requester_id, status').eq('id', id).single()
  if (!existing) throw new UserFacingError('Leave request not found.')
  if (existing.requester_id !== userId || existing.status !== 'pending') {
    throw new UserFacingError('You can only withdraw your own pending requests.')
  }
  const { error } = await supabase.from('leave_requests').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/hr')
}

export async function decideLeaveRequest(id: string, decision: 'approved' | 'rejected', note?: string | null): Promise<void> {
  const { supabase, userId, orgId, role } = await requireApprover()
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  const { data: existing } = await supabase
    .from('leave_requests')
    .select('id, requester_id, leave_type, start_date, end_date, status')
    .eq('id', id)
    .single()
  if (!existing) throw new UserFacingError('Leave request not found.')
  // Approvers may re-decide an already-decided request (e.g. correcting a mistake, or
  // reviewing one flagged from the Team leaves roster) — not just act on pending ones.

  const { error } = await supabase
    .from('leave_requests')
    .update({ status: decision, decided_by: userId, decided_at: new Date().toISOString(), decision_note: note?.trim() || null })
    .eq('id', id)
  if (error) throw dbFailure('save that', error)

  const span = existing.start_date === existing.end_date
    ? existing.start_date
    : `${existing.start_date} to ${existing.end_date}`

  // The one this whole system exists for: until now, the person who asked for the leave was never
  // told what happened to it, whichever way it went.
  await notify(supabase, {
    orgId,
    userIds: [existing.requester_id],
    actorId: userId,
    kind: 'leave_decided',
    title: `Leave ${decision}`,
    body: `${existing.leave_type}, ${span}${note?.trim() ? ` — ${note.trim()}` : ''}`,
    link: '/hr',
  })

  // Founders are told when someone other than a founder approves. This used to write escalation
  // rows (see 20260814700000); it is a notification now, so it stops inflating the open-escalation
  // count on the dashboard with things nobody escalated.
  if (decision === 'approved' && (role === 'admin' || role === 'hr')) {
    const { data: requester } = await supabase.from('users').select('name').eq('id', existing.requester_id).single()
    await notify(supabase, {
      orgId,
      userIds: await usersWithRoles(supabase, orgId, ['founder']),
      actorId: userId,
      kind: 'approval_recorded',
      title: `Leave approved: ${requester?.name ?? 'A team member'}`,
      body: `${existing.leave_type}, ${span}, approved by ${role}.`,
      link: '/approvals',
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/hr')
}

// Founder/admin/hr can cancel any request from the Team leaves roster, regardless of status
// (not just a requester withdrawing their own pending one — see withdrawLeaveRequest above).
export async function deleteLeaveRequestAsAdmin(id: string): Promise<void> {
  const { supabase } = await requireApprover()
  const { error } = await supabase.from('leave_requests').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/approvals')
  revalidatePath('/hr')
}
