'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// Only founder/admin/hr can see or adjust the clock-in/out windows and manage birthdays —
// narrowed from associate/general when the 'hr' role was introduced.
async function requireEditor() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type ClockSettingsInput = {
  clock_in_start: string
  clock_in_end: string
  clock_out_start: string
  clock_out_end: string
}

export async function updateClockSettings(input: ClockSettingsInput): Promise<void> {
  const { supabase, userId, orgId } = await requireEditor()
  const { error } = await supabase
    .from('hr_clock_settings')
    .upsert(
      { org_id: orgId, updated_by: userId, ...input },
      { onConflict: 'org_id' },
    )
  if (error) throw error
  revalidatePath('/hr')
}

export type BirthdayInput = {
  name: string
  birth_date: string
}

export async function createBirthday(input: BirthdayInput): Promise<void> {
  const { supabase, userId, orgId } = await requireEditor()
  const name = input.name.trim()
  if (!name) throw new UserFacingError('Name is required.')
  if (!input.birth_date) throw new UserFacingError('Date of birth is required.')

  const { error } = await supabase
    .from('hr_birthdays')
    .insert({ org_id: orgId, created_by: userId, name, birth_date: input.birth_date })
  if (error) throw error
  revalidatePath('/hr')
}

export async function updateBirthday(id: string, input: BirthdayInput): Promise<void> {
  const { supabase } = await requireEditor()
  const name = input.name.trim()
  if (!name) throw new UserFacingError('Name is required.')
  if (!input.birth_date) throw new UserFacingError('Date of birth is required.')

  const { error } = await supabase
    .from('hr_birthdays')
    .update({ name, birth_date: input.birth_date })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/hr')
}

export async function deleteBirthday(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('hr_birthdays').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/hr')
}
