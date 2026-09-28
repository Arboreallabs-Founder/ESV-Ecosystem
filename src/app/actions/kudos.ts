'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { notify } from '@/lib/notifications'
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
  const { supabase, userId, orgId, isExternal } = await requireInternal()
  // Kudos is ESV-team recognition — external team members neither give nor receive it.
  if (isExternal) throw new UserFacingError('Kudos is for ESV employees only.')
  const message = input.message.trim()
  if (!message) throw new UserFacingError('Message is required.')
  if (!input.recipient_id) throw new UserFacingError('Please choose who this is for.')
  if (input.recipient_id === userId) throw new UserFacingError('You cannot give kudos to yourself.')

  const { data: recipient } = await supabase.from('users').select('is_external').eq('id', input.recipient_id).single()
  if (recipient?.is_external) throw new UserFacingError('Kudos is for ESV employees only.')

  const { error } = await supabase.from('kudos').insert({
    org_id: orgId,
    giver_id: userId,
    recipient_id: input.recipient_id,
    message,
    category: input.category || null,
  })
  if (error) throw dbFailure('save that', error)

  // Kudos nobody sees is a strange thing to have built.
  const { data: giver } = await supabase.from('users').select('name').eq('id', userId).single()
  await notify(supabase, {
    orgId,
    userIds: [input.recipient_id],
    actorId: userId,
    kind: 'kudos_received',
    title: `${giver?.name ?? 'Someone'} gave you kudos`,
    body: message,
    link: '/engage',
  })

  revalidatePath('/engage')
}

export async function deleteKudos(id: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('kudos').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/engage')
}
