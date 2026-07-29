'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { entitlementFor, fetchLeavePolicy } from '@/lib/leave-balances'
import { BALANCE_LEAVE_TYPES, type LeaveType } from '@/lib/types'

async function requireApprover() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type AvailableBalanceInput = {
  user_id: string
  /** What should be left, in days. Half-days allowed. */
  available: Record<string, number>
}

/**
 * HR types "they have N days available"; we store the manual baseline that makes that true:
 *
 *     manual_used = entitlement − alreadyApprovedDays − typedAvailable
 *
 * Storing the baseline rather than the remaining figure is what keeps the number honest — future
 * approved leave still deducts on top of it, so the balance can't silently disagree with the
 * approvals that actually happened.
 */
export async function setAvailableBalances(input: AvailableBalanceInput): Promise<void> {
  const { supabase, userId, orgId } = await requireApprover()
  if (!orgId) throw new Error('No organization found for this account.')
  if (!input.user_id) throw new Error('No person selected.')

  const policy = await fetchLeavePolicy()

  // Approved leave already taken, so the typed figure lands exactly where HR put it.
  const { data: approved } = await supabase
    .from('leave_requests')
    .select('leave_type, start_date, end_date, is_half_day')
    .eq('requester_id', input.user_id)
    .eq('status', 'approved')
    .in('leave_type', BALANCE_LEAVE_TYPES)

  const usedByType = new Map<string, number>()
  for (const r of approved ?? []) {
    const days = r.is_half_day
      ? 0.5
      : Math.round((new Date(`${r.end_date}T00:00:00`).getTime() - new Date(`${r.start_date}T00:00:00`).getTime()) / 86_400_000) + 1
    usedByType.set(r.leave_type, (usedByType.get(r.leave_type) ?? 0) + days)
  }

  const rows = BALANCE_LEAVE_TYPES.map((type: LeaveType) => {
    const available = Number(input.available[type])
    if (!Number.isFinite(available)) throw new Error(`Enter a valid number for ${type}.`)
    if (available < 0) throw new Error('Balances cannot be negative.')
    // Half-day granularity — reject 0.3-style values rather than silently rounding them.
    if (Math.round(available * 2) !== available * 2) throw new Error('Balances move in half-day steps.')

    const entitled = entitlementFor(policy, type)
    const manualUsed = entitled - (usedByType.get(type) ?? 0) - available
    return {
      org_id: orgId,
      user_id: input.user_id,
      leave_type: type,
      manual_used_days: Math.round(manualUsed * 100) / 100,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase.from('leave_balances').upsert(rows, { onConflict: 'user_id,leave_type' })
  if (error) throw error
  revalidatePath('/approvals')
  revalidatePath('/hr')
}

export type LeavePolicyInput = {
  earned_days: number
  sick_days: number
  my_day_days: number
  compensatory_days: number
  wfh_days: number
}

export async function updateLeavePolicy(input: LeavePolicyInput): Promise<void> {
  const { supabase, userId, orgId } = await requireApprover()
  if (!orgId) throw new Error('No organization found for this account.')

  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be zero or more.`)
  }

  const { error } = await supabase.from('leave_policy').upsert(
    { org_id: orgId, updated_by: userId, ...input },
    { onConflict: 'org_id' },
  )
  if (error) throw error
  revalidatePath('/approvals')
  revalidatePath('/hr')
}
