import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Escalation } from './types'

export const fetchEscalations = cache(async (): Promise<Escalation[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('escalations')
    .select('*, raised_by_user:raised_by(name), recipient_user:recipient_user_id(name, role)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Escalation[]
})

export const fetchOpenEscalationCount = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('escalations')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Resolved')
  return count ?? 0
})
