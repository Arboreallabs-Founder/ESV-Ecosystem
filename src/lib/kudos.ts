import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Kudos } from './types'

const INTERNAL_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']

export const fetchKudosFeed = cache(async (): Promise<Kudos[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kudos')
    .select('*, giver:giver_id(name, photo_url), recipient:recipient_id(name, photo_url)')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as Kudos[]
})

export const fetchKudosRecipientOptions = cache(async (currentUserId: string): Promise<Array<{ id: string; name: string }>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, name')
    .in('role', INTERNAL_ROLES)
    .neq('id', currentUserId)
    .order('name')
  return (data ?? []) as Array<{ id: string; name: string }>
})
