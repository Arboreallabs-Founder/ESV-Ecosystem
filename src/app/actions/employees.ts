'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { EmploymentType, BloodGroup } from '@/lib/types'

/* Employee profiles and compensation.

   Both are founder/admin/HR only. The RLS policies enforce that independently — these guards
   exist so a refusal is a readable error rather than a silent zero-row write. */

async function requirePeopleAdmin() {
  return requireRole(['founder', 'admin', 'hr'])
}

/**
 * How many populated fields a single save may blank before it is treated as a mistake.
 *
 * Four, because clearing two or three by hand is plausible housekeeping (an exit date and reason,
 * say) while clearing four or more in one go is the signature of submitting a form that rendered
 * empty when it shouldn't have.
 */
const WIPE_THRESHOLD = 4

export type EmployeeProfileInput = {
  employee_code?: string | null
  date_of_joining?: string | null
  employment_type?: EmploymentType | null
  probation_end_date?: string | null
  confirmation_date?: string | null
  reporting_manager_id?: string | null
  work_location?: string | null
  notice_period_days?: number | null
  date_of_exit?: string | null
  exit_reason?: string | null
  legal_name?: string | null
  date_of_birth?: string | null
  residential_address?: string | null
  personal_email?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  blood_group?: BloodGroup | null
}

/** Empty strings from a form mean "cleared", not "the empty string". */
function clean<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    out[k] = typeof v === 'string' ? (v.trim() || null) : (v ?? null)
  }
  return out
}

export async function saveEmployeeProfile(userId: string, input: EmployeeProfileInput): Promise<void> {
  const { supabase, userId: callerId, orgId } = await requirePeopleAdmin()
  if (!orgId) throw new UserFacingError('No organization found for this account.')
  if (!userId) throw new UserFacingError('No employee selected.')

  const patch = clean(input)

  if (patch.notice_period_days != null && Number(patch.notice_period_days) < 0) {
    throw new UserFacingError('Notice period cannot be negative.')
  }
  // A confirmation before the joining date is a data-entry slip that would end up printed on a
  // letter, so it's rejected here rather than left to be noticed later.
  const doj = patch.date_of_joining as string | null
  for (const field of ['probation_end_date', 'confirmation_date', 'date_of_exit'] as const) {
    const value = patch[field] as string | null
    if (doj && value && value < doj) {
      throw new UserFacingError(`${field.replace(/_/g, ' ')} cannot be before the joining date.`)
    }
  }

  /*
   * Refuse a save that would wipe most of an existing profile.
   *
   * The form submits every field every time, so anything the browser shows as blank is written as
   * NULL. If the form ever renders blank when it shouldn't — a failed read, a stale tab, a client
   * bug not yet found — one click destroys hand-entered data with no audit trail to recover it
   * from. This has already happened once.
   *
   * The client has its own guards; this one cannot be bypassed by whatever the client does wrong.
   * Clearing a few fields deliberately still works, which is the common legitimate case.
   */
  const { data: existing } = await supabase
    .from('employee_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const clearing = Object.keys(patch).filter((k) => {
      const before = (existing as Record<string, unknown>)[k]
      return before !== null && before !== undefined && before !== '' && patch[k] === null
    })
    if (clearing.length >= WIPE_THRESHOLD) {
      throw new UserFacingError(
        `This would clear ${clearing.length} fields that currently have values `
        + `(${clearing.slice(0, 4).map((f) => f.replace(/_/g, ' ')).join(', ')}`
        + `${clearing.length > 4 ? ', …' : ''}). `
        + 'If the form looks empty, reload the page rather than saving — the data is probably '
        + 'still there. To clear fields deliberately, do it a few at a time.',
      )
    }
  }

  const { error } = await supabase
    .from('employee_profiles')
    .upsert(
      { user_id: userId, org_id: orgId, updated_by: callerId, ...patch },
      { onConflict: 'user_id' },
    )
  if (error) throw error

  revalidatePath('/hr')
}

export type CompensationInput = {
  effective_from: string
  annual_ctc: number
  basic?: number | null
  hra?: number | null
  special_allowance?: number | null
  employer_pf?: number | null
  gratuity?: number | null
  variable_pay?: number | null
  other_allowances?: number | null
  currency?: string
  notes?: string | null
}

/**
 * Add or correct a compensation record.
 *
 * Upserts on (user_id, effective_from): saving the same start date twice corrects that record
 * rather than creating a second one claiming to be in force on the same day. A *new* package
 * gets a new effective date, which is what preserves history.
 */
export async function saveCompensation(userId: string, input: CompensationInput): Promise<void> {
  const { supabase, userId: callerId, orgId } = await requirePeopleAdmin()
  if (!orgId) throw new UserFacingError('No organization found for this account.')
  if (!userId) throw new UserFacingError('No employee selected.')
  if (!input.effective_from) throw new UserFacingError('An effective date is required.')

  const ctc = Number(input.annual_ctc)
  if (!Number.isFinite(ctc) || ctc < 0) throw new UserFacingError('Enter a valid annual CTC.')

  const num = (v: number | null | undefined) => {
    if (v === null || v === undefined || (v as unknown as string) === '') return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) throw new UserFacingError('Breakdown amounts must be zero or more.')
    return n
  }

  const { error } = await supabase.from('employee_compensation').upsert({
    org_id: orgId,
    user_id: userId,
    effective_from: input.effective_from,
    annual_ctc: ctc,
    basic: num(input.basic),
    hra: num(input.hra),
    special_allowance: num(input.special_allowance),
    employer_pf: num(input.employer_pf),
    gratuity: num(input.gratuity),
    variable_pay: num(input.variable_pay),
    other_allowances: num(input.other_allowances),
    currency: input.currency?.trim() || 'INR',
    notes: input.notes?.trim() || null,
    created_by: callerId,
  }, { onConflict: 'user_id,effective_from' })
  if (error) throw error

  revalidatePath('/hr')
}

/**
 * Remove a compensation record. Founder only, and rare by design — deleting one destroys the
 * basis of any payslip already issued against it. Corrections should edit the row instead.
 */
export async function deleteCompensation(id: string): Promise<void> {
  const { supabase } = await requireRole(['founder'])
  const { error } = await supabase.from('employee_compensation').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/hr')
}
