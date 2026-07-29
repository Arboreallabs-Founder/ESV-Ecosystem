import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  BALANCE_LEAVE_TYPES, POLICY_COLUMN,
  type LeaveBalance, type LeaveBalanceRow, type LeavePolicy, type LeaveType,
} from './types'

/* Balance model
   -------------
   Entitlement is an ORG-WIDE standard (leave_policy), not per-person.
   Remaining = entitlement − manual baseline − days already approved through leave_requests.

   Remaining is always COMPUTED, never stored, so it cannot drift out of sync with actual
   approvals. When HR types an available balance in the UI, the action back-solves the manual
   baseline from it (see setAvailableBalance in app/actions/leave-balances.ts) — so the number
   they typed is what shows, and future approvals still deduct correctly on top of it. */

// Founders are excluded from the balance roster — owners, not managed employees.
const BALANCE_ROSTER_ROLES = ['admin', 'associate', 'general', 'hr']

const DEFAULT_POLICY: Omit<LeavePolicy, 'id' | 'updated_at'> = {
  earned_days: 20, sick_days: 10, my_day_days: 2, compensatory_days: 20, wfh_days: 24,
}

/** Whole days between two dates, inclusive; a flagged single-day request counts as 0.5. */
function requestDays(start: string, end: string, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Half-day granularity — avoids 12.299999999 style float drift in displayed balances. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const fetchLeavePolicy = cache(async (): Promise<LeavePolicy> => {
  const supabase = await createClient()
  const { data } = await supabase.from('leave_policy').select('*').maybeSingle()
  if (!data) return { id: '', updated_at: '', ...DEFAULT_POLICY }
  return data as LeavePolicy
})

export function entitlementFor(policy: LeavePolicy, type: LeaveType): number {
  const col = POLICY_COLUMN[type]
  return col ? Number(policy[col] ?? 0) : 0
}

type RawBalanceRow = { id: string; user_id: string; leave_type: LeaveType; manual_used_days: number }

function buildBalance(
  userId: string, type: LeaveType, policy: LeavePolicy,
  manualUsed: number, usedFromRequests: number, id: string | null,
): LeaveBalance {
  const entitled = entitlementFor(policy, type)
  return {
    id,
    user_id: userId,
    leave_type: type,
    entitled_days: entitled,
    manual_used_days: round2(manualUsed),
    used_from_requests: round2(usedFromRequests),
    remaining: round2(entitled - manualUsed - usedFromRequests),
  }
}

/** Org-wide matrix backing the Balances tab. */
export const fetchAllLeaveBalances = cache(async (): Promise<LeaveBalanceRow[]> => {
  const supabase = await createClient()
  const [policy, usersRes, balancesRes, approvedRes] = await Promise.all([
    fetchLeavePolicy(),
    supabase.from('users').select('id, name, designation, photo_url').in('role', BALANCE_ROSTER_ROLES).order('name'),
    supabase.from('leave_balances').select('id, user_id, leave_type, manual_used_days'),
    supabase.from('leave_requests')
      .select('requester_id, leave_type, start_date, end_date, is_half_day')
      .eq('status', 'approved').in('leave_type', BALANCE_LEAVE_TYPES),
  ])

  const usedFromRequests = new Map<string, number>()
  for (const r of approvedRes.data ?? []) {
    const key = `${r.requester_id}:${r.leave_type}`
    usedFromRequests.set(key, (usedFromRequests.get(key) ?? 0) + requestDays(r.start_date, r.end_date, r.is_half_day))
  }

  const balanceByKey = new Map<string, RawBalanceRow>()
  for (const b of (balancesRes.data ?? []) as RawBalanceRow[]) balanceByKey.set(`${b.user_id}:${b.leave_type}`, b)

  return (usersRes.data ?? []).map((u: { id: string; name: string | null; designation: string | null; photo_url: string | null }) => {
    const row: LeaveBalanceRow = {
      user_id: u.id,
      user_name: u.name ?? 'Unknown',
      designation: u.designation,
      photo_url: u.photo_url,
      balances: {},
    }
    for (const type of BALANCE_LEAVE_TYPES) {
      const key = `${u.id}:${type}`
      const stored = balanceByKey.get(key)
      row.balances[type] = buildBalance(
        u.id, type, policy,
        Number(stored?.manual_used_days ?? 0),
        usedFromRequests.get(key) ?? 0,
        stored?.id ?? null,
      )
    }
    return row
  })
})

/** Self-scoped balances — the summary bar and the leave request form. */
export const fetchMyLeaveBalances = cache(async (userId: string): Promise<Record<string, LeaveBalance>> => {
  const supabase = await createClient()
  const [policy, balancesRes, approvedRes] = await Promise.all([
    fetchLeavePolicy(),
    supabase.from('leave_balances').select('leave_type, manual_used_days').eq('user_id', userId),
    supabase.from('leave_requests')
      .select('leave_type, start_date, end_date, is_half_day')
      .eq('requester_id', userId).eq('status', 'approved').in('leave_type', BALANCE_LEAVE_TYPES),
  ])

  const usedByType = new Map<LeaveType, number>()
  for (const r of approvedRes.data ?? []) {
    const t = r.leave_type as LeaveType
    usedByType.set(t, (usedByType.get(t) ?? 0) + requestDays(r.start_date, r.end_date, r.is_half_day))
  }
  const manualByType = new Map<LeaveType, number>()
  for (const b of balancesRes.data ?? []) manualByType.set(b.leave_type as LeaveType, Number(b.manual_used_days ?? 0))

  const result: Record<string, LeaveBalance> = {}
  for (const type of BALANCE_LEAVE_TYPES) {
    result[type] = buildBalance(userId, type, policy, manualByType.get(type) ?? 0, usedByType.get(type) ?? 0, null)
  }
  return result
})
