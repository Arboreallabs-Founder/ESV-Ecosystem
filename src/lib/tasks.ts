import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Task, TaskPush } from './types'

export const fetchAllTasks = cache(async (): Promise<Task[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:assignee_id(name, photo_url), created_by_user:created_by(name), assigned_by_user:assigned_by_id(name), company:company_id(id, name), desk_deal:desk_deal_id(id, company_name)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Task[]
})

/* The push log behind the /tasks/kpi "why it moved" breakdown. RLS scopes it: founder/admin see
   the org, everyone else sees pushes on their own tasks. The maths over these rows is in
   src/lib/task-pushes.ts, which stays free of server imports so client components can use it. */
export const fetchPushes = cache(async (): Promise<TaskPush[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('task_pushes')
    .select('*, pushed_by_user:pushed_by(name, photo_url), blocked_by_user:blocked_by_user_id(name, photo_url), task:task_id(title, assignee_id)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as TaskPush[]
})

export const fetchOpenTaskCount = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Done')
  return count ?? 0
})

// The sidebar bell used to be fed from here, by two queries on every navigation — one of which
// pulled 200 comment rows and filtered them in JavaScript. It reads public.notifications now;
// see src/lib/notifications.ts.
