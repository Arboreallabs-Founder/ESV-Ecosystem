import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { BALANCE_LEAVE_TYPES, type LeaveBalance, type LeaveBalanceRow, type LeaveType } from './types'

// Founders don't get entitlement/balance tracking (they're owners, not managed employees) — the
// Balances roster excludes them. They can still submit their own leave requests (fetchMyLeaveBalances
// below works for any user regardless of role) and show up on the Team leaves roster if they do.
const BALANCE_ROSTER_ROLES = ['admin', 'associate', 'general', 'hr']

function daysInclusive(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

type RawBalanceRow = { id: string; user_id: string; leave_type: LeaveType; entitled_days: number; manual_used_days: number }

// Full org-wide matrix: every internal user × every balance-eligible leave type, defaulting to
// zeroed-out entries for combos HR hasn't set yet — backs the "Balances" tab on /approvals.
export const fetchAllLeaveBalances = cache(async (): Promise<LeaveBalanceRow[]> => {
  const supabase = await createClient()
  const [{ data: users }, { data: balances }, { data: approved }] = await Promise.all([
    supabase.from('users').select('id, name').in('role', BALANCE_ROSTER_ROLES).order('name'),
    supabase.from('leave_balances').select('*'),
    supabase.from('leave_requests').select('requester_id, leave_type, start_date, end_date')
      .eq('status', 'approved').in('leave_type', BALANCE_LEAVE_TYPES),
  ])

  const usedFromRequests = new Map<string, number>()
  for (const r of approved ?? []) {
    const key = `${r.requester_id}:${r.leave_type}`
    usedFromRequests.set(key, (usedFromRequests.get(key) ?? 0) + daysInclusive(r.start_date, r.end_date))
  }

  const balanceByKey = new Map<string, RawBalanceRow>()
  for (const b of (balances ?? []) as RawBalanceRow[]) balanceByKey.set(`${b.user_id}:${b.leave_type}`, b)

  return (users ?? []).map((u: { id: string; name: string | null }) => {
    const row: LeaveBalanceRow = { user_id: u.id, user_name: u.name ?? 'Unknown', balances: {} }
    for (const type of BALANCE_LEAVE_TYPES) {
      const key = `${u.id}:${type}`
      const stored = balanceByKey.get(key)
      const used = usedFromRequests.get(key) ?? 0
      const entitled = stored?.entitled_days ?? 0
      const manualUsed = stored?.manual_used_days ?? 0
      row.balances[type] = {
        id: stored?.id ?? null,
        user_id: u.id,
        leave_type: type,
        entitled_days: entitled,
        manual_used_days: manualUsed,
        used_from_requests: used,
        remaining: entitled - manualUsed - used,
      }
    }
    return row
  })
})

// Self-scoped view (only the 4 balance-eligible types) for the informational display on the
// leave request form — deliberately not enforced, just shown.
export const fetchMyLeaveBalances = cache(async (userId: string): Promise<Record<string, LeaveBalance>> => {
  const supabase = await createClient()
  const [{ data: balances }, { data: approved }] = await Promise.all([
    supabase.from('leave_balances').select('*').eq('user_id', userId),
    supabase.from('leave_requests').select('leave_type, start_date, end_date')
      .eq('requester_id', userId).eq('status', 'approved').in('leave_type', BALANCE_LEAVE_TYPES),
  ])

  const usedByType = new Map<LeaveType, number>()
  for (const r of approved ?? []) {
    usedByType.set(r.leave_type as LeaveType, (usedByType.get(r.leave_type as LeaveType) ?? 0) + daysInclusive(r.start_date, r.end_date))
  }
  const storedByType = new Map<LeaveType, { entitled_days: number; manual_used_days: number }>()
  for (const b of balances ?? []) storedByType.set(b.leave_type, b)

  const result: Record<string, LeaveBalance> = {}
  for (const type of BALANCE_LEAVE_TYPES) {
    const stored = storedByType.get(type)
    const used = usedByType.get(type) ?? 0
    const entitled = stored?.entitled_days ?? 0
    const manualUsed = stored?.manual_used_days ?? 0
    result[type] = { id: null, user_id: userId, leave_type: type, entitled_days: entitled, manual_used_days: manualUsed, used_from_requests: used, remaining: entitled - manualUsed - used }
  }
  return result
})
