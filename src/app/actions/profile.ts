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
