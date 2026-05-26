import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Task } from './types'

export const fetchAllTasks = cache(async (): Promise<Task[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:assignee_id(name), deal:deal_id(company_name)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Task[]
})

export const fetchOpenTaskCount = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Done')
  return count ?? 0
})
