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
    .select('*, pushed_by_user:pushed_by(name), blocked_by_user:blocked_by_user_id(name), task:task_id(title, assignee_id)')
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

// `kind: 'assigned'` = a new task landed on you; `kind: 'comment'` = someone commented on
// a task assigned to you. `id` is always the task id (comments alerts open that task too).
export type TaskAlert = { id: string; title: string; created_at: string; kind: 'assigned' | 'comment'; by?: string }

// Lightweight feed for the sidebar alerts bell — just enough to tell "is this new to me".
export const fetchMyOpenTaskAlerts = cache(async (userId: string): Promise<TaskAlert[]> => {
  const supabase = await createClient()
  const [{ data: assigned }, { data: comments }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, created_at')
      .eq('assignee_id', userId)
      .neq('status', 'Done')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('task_comments')
      .select('created_at, author:author_id(name), task:task_id(id, title, assignee_id)')
      .neq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const assignedAlerts: TaskAlert[] = (assigned ?? []).map((t) => ({
    id: t.id, title: t.title, created_at: t.created_at, kind: 'assigned',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentAlerts: TaskAlert[] = ((comments ?? []) as any[])
    .filter((c) => c.task?.assignee_id === userId)
    .map((c) => ({
      id: c.task.id as string, title: c.task.title as string, created_at: c.created_at as string,
      kind: 'comment', by: c.author?.name ?? 'Someone',
    }))

  return [...assignedAlerts, ...commentAlerts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)
})
