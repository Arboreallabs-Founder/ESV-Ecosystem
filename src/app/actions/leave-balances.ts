'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { LeaveType } from '@/lib/types'

async function requireApprover() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type LeaveBalanceInput = {
  user_id: string
  leave_type: LeaveType
  entitled_days: number
  manual_used_days: number
}

export async function upsertLeaveBalance(input: LeaveBalanceInput): Promise<void> {
  const { supabase, userId, orgId } = await requireApprover()
  if (!orgId) throw new Error('No organization found for this account.')
  if (input.entitled_days < 0 || input.manual_used_days < 0) throw new Error('Values cannot be negative.')

  const { error } = await supabase.from('leave_balances').upsert(
    {
      org_id: orgId,
      user_id: input.user_id,
      leave_type: input.leave_type,
      entitled_days: input.entitled_days,
      manual_used_days: input.manual_used_days,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,leave_type' },
  )
  if (error) throw error
  revalidatePath('/approvals')
  revalidatePath('/hr')
}
