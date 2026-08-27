'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { KudosCategory } from '@/lib/types'

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

export type KudosInput = {
  recipient_id: string
  message: string
  category?: KudosCategory | null
}

export async function giveKudos(input: KudosInput): Promise<void> {
  const { supabase, userId, orgId } = await requireInternal()
  const message = input.message.trim()
  if (!message) throw new UserFacingError('Message is required.')
  if (!input.recipient_id) throw new UserFacingError('Please choose who this is for.')
  if (input.recipient_id === userId) throw new UserFacingError('You cannot give kudos to yourself.')

  const { error } = await supabase.from('kudos').insert({
    org_id: orgId,
    giver_id: userId,
    recipient_id: input.recipient_id,
    message,
    category: input.category || null,
  })
  if (error) throw error
  revalidatePath('/engage')
}

export async function deleteKudos(id: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('kudos').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/engage')
}
