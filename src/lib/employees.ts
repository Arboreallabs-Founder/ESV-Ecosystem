import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { EmployeeProfile, EmployeeRow, EmployeeCompensation, UserRow } from './types'

/* Employee profiles and compensation — the data HR letters are made of.

   Both tables are RLS-scoped, so these functions return whatever the caller is allowed to see and
   nothing more. Compensation in particular has no self-read policy: an associate calling
   fetchCompensationHistory for themselves gets an empty array, not an error. */

/** Roles that appear on the People roster.
 *
 *  Founders are excluded — they own the company rather than being managed by it, so there is no
 *  employment record to keep or letters to issue against. Partners aren't employees and
 *  super_admin isn't staff. */
const STAFF_ROLES = ['admin', 'associate', 'general', 'hr']

const PROFILE_SELECT = '*, reporting_manager:reporting_manager_id(name)'

export const fetchEmployeeRoster = cache(async (): Promise<EmployeeRow[]> => {
  const supabase = await createClient()
  const [{ data: users }, { data: profiles }] = await Promise.all([
    supabase.from('users').select('*').in('role', STAFF_ROLES).order('name'),
    supabase.from('employee_profiles').select(PROFILE_SELECT),
  ])

  const byUser = new Map<string, EmployeeProfile>()
  for (const p of (profiles ?? []) as unknown as EmployeeProfile[]) byUser.set(p.user_id, p)

  // Everyone on staff appears, with or without a profile — a person with no profile yet is the
  // normal starting state and the roster is where you go to fix that.
  return (users ?? []).map((u) => ({
    user: u as unknown as UserRow,
    profile: byUser.get((u as { id: string }).id) ?? null,
  }))
})

export const fetchEmployeeProfile = cache(async (userId: string): Promise<EmployeeProfile | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_profiles')
    .select(PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as unknown as EmployeeProfile) ?? null
})

/**
 * Every compensation record for someone, newest first.
 * Returns [] rather than throwing when the caller can't read compensation — RLS filters silently.
 */
export const fetchCompensationHistory = cache(async (userId: string): Promise<EmployeeCompensation[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_compensation')
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false })
  return (data ?? []) as unknown as EmployeeCompensation[]
})

/**
 * The package in force on a given date — the row with the latest `effective_from` at or before it.
 *
 * `asOf` matters: a payslip for March must use what was true in March, not today's figure. Passing
 * today gives the current package.
 */
export function compensationAsOf(
  history: EmployeeCompensation[],
  asOf: string,
): EmployeeCompensation | null {
  // History arrives newest-first, so the first row not in the future is the one in force.
  return history.find((c) => c.effective_from <= asOf) ?? null
}

/** Whether the breakdown lines add up to the headline figure, within a rupee. */
export function breakdownMatchesCtc(c: EmployeeCompensation): boolean | null {
  const parts = [c.basic, c.hra, c.special_allowance, c.employer_pf, c.gratuity, c.variable_pay, c.other_allowances]
  // No breakdown entered at all is not a mismatch — plenty of consultants have a headline only.
  if (parts.every((p) => p == null)) return null
  const sum = parts.reduce<number>((acc, p) => acc + Number(p ?? 0), 0)
  return Math.abs(sum - Number(c.annual_ctc)) < 1
}
