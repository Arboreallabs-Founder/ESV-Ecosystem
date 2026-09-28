'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { notify, usersWithRoles } from '@/lib/notifications'
import type { ExpenseType } from '@/lib/types'

const APPROVER_ROLES = ['founder', 'admin', 'hr']

async function requireRequester() {
  const ctx = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
  // External team members aren't ESV employees, so expense reimbursement doesn't apply to them —
  // same reasoning that keeps them off the attendance roster.
  if (ctx.isExternal) throw new UserFacingError('Expense requests are for ESV employees only.')
  return ctx
}

async function requireApprover() {
  return requireRole(APPROVER_ROLES)
}

export type ExpenseRequestInput = {
  expense_type: ExpenseType
  amount: number
  description?: string | null
  invoice_path: string
}

// invoice_path is uploaded client-side to the private `expenses` bucket before this is called
// (same discipline as Deal Desk's uploads — this action only ever receives the resulting path).
export async function createExpenseRequest(input: ExpenseRequestInput): Promise<void> {
  const { supabase, userId, orgId } = await requireRequester()
  if (!input.invoice_path) throw new UserFacingError('An invoice attachment is required.')
  if (!input.amount || input.amount <= 0) throw new UserFacingError('Enter a valid amount.')

  const { error } = await supabase.from('expense_requests').insert({
    org_id: orgId,
    requester_id: userId,
    expense_type: input.expense_type,
    amount: input.amount,
    description: input.description?.trim() || null,
    invoice_path: input.invoice_path,
  })
  if (error) throw dbFailure('save that', error)

  if (orgId) {
    const { data: requester } = await supabase.from('users').select('name').eq('id', userId).single()
    await notify(supabase, {
      orgId,
      userIds: await usersWithRoles(supabase, orgId, APPROVER_ROLES),
      actorId: userId,
      kind: 'expense_submitted',
      title: `${requester?.name ?? 'A team member'} submitted an expense`,
      body: `${input.expense_type}, ₹${input.amount}`,
      link: '/approvals',
    })
  }

  revalidatePath('/hr')
  revalidatePath('/approvals')
}

export async function withdrawExpenseRequest(id: string): Promise<void> {
  const { supabase, userId } = await requireRequester()
  const { data: existing } = await supabase.from('expense_requests').select('requester_id, status, invoice_path').eq('id', id).single()
  if (!existing) throw new UserFacingError('Expense request not found.')
  if (existing.requester_id !== userId || existing.status !== 'pending') {
    throw new UserFacingError('You can only withdraw your own pending requests.')
  }
  const { error } = await supabase.from('expense_requests').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  await supabase.storage.from('expenses').remove([existing.invoice_path])
  revalidatePath('/hr')
}

export async function decideExpenseRequest(id: string, decision: 'approved' | 'rejected', note?: string | null): Promise<void> {
  const { supabase, userId, orgId, role } = await requireApprover()
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  const { data: existing } = await supabase
    .from('expense_requests')
    .select('id, requester_id, expense_type, amount, status')
    .eq('id', id)
    .single()
  if (!existing) throw new UserFacingError('Expense request not found.')
  if (existing.status !== 'pending') throw new UserFacingError('This request has already been decided.')

  const { error } = await supabase
    .from('expense_requests')
    .update({ status: decision, decided_by: userId, decided_at: new Date().toISOString(), decision_note: note?.trim() || null })
    .eq('id', id)
  if (error) throw dbFailure('save that', error)

  // As with leave: the requester was previously never told either way.
  await notify(supabase, {
    orgId,
    userIds: [existing.requester_id],
    actorId: userId,
    kind: 'expense_decided',
    title: `Expense ${decision}`,
    body: `${existing.expense_type}, ₹${existing.amount}${note?.trim() ? ` — ${note.trim()}` : ''}`,
    link: '/hr',
  })

  if (decision === 'approved' && (role === 'admin' || role === 'hr')) {
    const { data: requester } = await supabase.from('users').select('name').eq('id', existing.requester_id).single()
    await notify(supabase, {
      orgId,
      userIds: await usersWithRoles(supabase, orgId, ['founder']),
      actorId: userId,
      kind: 'approval_recorded',
      title: `Expense approved: ${requester?.name ?? 'A team member'}`,
      body: `${existing.expense_type}, ₹${existing.amount}, approved by ${role}.`,
      link: '/approvals',
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/hr')
}
