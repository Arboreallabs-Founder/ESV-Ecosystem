import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Task } from './types'

export const fetchAllTasks = cache(async (): Promise<Task[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:assignee_id(name), created_by_user:created_by(name), assigned_by_user:assigned_by_id(name), company:company_id(id, name), desk_deal:desk_deal_id(id, company_name)')
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

export type TaskAlert = { id: string; title: string; created_at: string }

// Lightweight feed for the sidebar alerts bell — just enough to tell "is this new to me".
export const fetchMyOpenTaskAlerts = cache(async (userId: string): Promise<TaskAlert[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, created_at')
    .eq('assignee_id', userId)
    .neq('status', 'Done')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as TaskAlert[]
})
