'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

/* The company holiday calendar.
 *
 * Same write tier as the clock settings and birthdays it sits beside in HR Zone — this is HR
 * calendar config. Everyone internal reads it (RLS), because the leave form shows the working-day
 * count as someone picks their dates.
 */
async function requireEditor() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type HolidayInput = {
  holiday_date: string
  name: string
  kind?: 'public' | 'company'
}

function validate(input: HolidayInput) {
  const name = input.name.trim()
  if (!name) throw new UserFacingError('Holiday name is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.holiday_date)) throw new UserFacingError('A valid date is required.')
  return { name, kind: input.kind ?? 'public' }
}

// A duplicate date trips the UNIQUE(org_id, holiday_date) constraint. Postgres reports that as
// 23505, which reaches the user as an unreadable constraint name unless it is named here.
function describeConflict(error: { code?: string }, date: string): never | void {
  if (error.code === '23505') throw new UserFacingError(`${date} is already on the holiday calendar.`)
}

export async function createHoliday(input: HolidayInput): Promise<void> {
  const { supabase, userId, orgId } = await requireEditor()
  const { name, kind } = validate(input)

  const { error } = await supabase.from('holidays').insert({
    org_id: orgId, holiday_date: input.holiday_date, name, kind, created_by: userId,
  })
  if (error) { describeConflict(error, input.holiday_date); throw dbFailure('save that', error) }

  revalidatePath('/hr')
  revalidatePath('/approvals')
}

export async function updateHoliday(id: string, input: HolidayInput): Promise<void> {
  const { supabase } = await requireEditor()
  const { name, kind } = validate(input)

  const { error } = await supabase
    .from('holidays')
    .update({ holiday_date: input.holiday_date, name, kind })
    .eq('id', id)
  if (error) { describeConflict(error, input.holiday_date); throw dbFailure('save that', error) }

  revalidatePath('/hr')
  revalidatePath('/approvals')
}

export async function deleteHoliday(id: string): Promise<void> {
  const { supabase } = await requireEditor()
  const { error } = await supabase.from('holidays').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)

  revalidatePath('/hr')
  revalidatePath('/approvals')
}
