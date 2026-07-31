'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/guards'

export async function updateMyProfile(input: {
  name: string
  phone: string | null
  designation: string | null
  location: string | null
}) {
  const { supabase, userId } = await requireAuth()
  const name = input.name.trim()
  if (!name) throw new Error('Name is required.')
  const { error } = await supabase.from('users').update({
    name,
    phone: input.phone?.trim() || null,
    designation: input.designation?.trim() || null,
    location: input.location?.trim() || null,
  }).eq('id', userId)
  if (error) throw error
  revalidatePath('/settings')
}

export async function updateMyPhoto(photoUrl: string | null) {
  const { supabase, userId } = await requireAuth()
  const { error } = await supabase.from('users').update({ photo_url: photoUrl }).eq('id', userId)
  if (error) throw error
  revalidatePath('/settings')
}

/**
 * Set (or clear) your own ID-card photo.
 *
 * Separate from `updateMyPhoto` on purpose. That one sets `users.photo_url`, the avatar shown
 * beside your name all over the app, which may well have been mirrored in from a LinkedIn link.
 * This sets `employee_profiles.id_photo_url`, which appears on an identity document — so it has
 * to be a photo the person deliberately uploaded for that purpose.
 *
 * The write is scoped to this one column and to the caller's own row; everything else on the
 * profile stays founder/admin/HR-only, because those fields are what letters assert.
 */
export async function updateMyIdPhoto(idPhotoUrl: string | null) {
  const { supabase, userId } = await requireAuth()

  const { data: existing } = await supabase
    .from('employee_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    throw new Error('Your employee profile has not been set up yet — ask HR to create it first.')
  }

  const { error } = await supabase
    .from('employee_profiles')
    .update({ id_photo_url: idPhotoUrl })
    .eq('user_id', userId)
  if (error) throw error

  revalidatePath('/settings')
  revalidatePath('/hr')
}
