'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { notifyFoundersOfApproval } from '@/lib/notify-founders'
import type { ExpenseType } from '@/lib/types'

async function requireRequester() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

async function requireApprover() {
  return requireRole(['founder', 'admin', 'hr'])
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
  revalidatePath('/hr')
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

  if (decision === 'approved' && (role === 'admin' || role === 'hr')) {
    const { data: requester } = await supabase.from('users').select('name').eq('id', existing.requester_id).single()
    await notifyFoundersOfApproval(supabase, {
      orgId,
      actorId: userId,
      subject: `Expense approved: ${requester?.name ?? 'A team member'}`,
      body: `${existing.expense_type} expense, ₹${existing.amount}, approved by ${role}.`,
      linkedType: 'expense_request',
      linkedId: existing.id,
      linkedTitle: `${requester?.name ?? 'Expense request'} — ${existing.expense_type}`,
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/hr')
  revalidatePath('/escalations')
}
