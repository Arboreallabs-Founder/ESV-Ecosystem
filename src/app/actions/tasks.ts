'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { TaskComment } from '@/lib/types'

export async function createTask(formData: FormData) {
  const { supabase, userId, orgId, role } = await requireRole(['founder', 'admin', 'associate'])

  const assigneeId = (formData.get('assignee_id') as string) || userId

  // Assignment rules: never assign to a partner; associates may only assign to
  // themselves or other associates. (RLS double-guards these.)
  if (assigneeId !== userId) {
    const { data: assignee } = await supabase
      .from('users')
      .select('role')
      .eq('id', assigneeId)
      .single()
    const assigneeRole = assignee?.role
    if (assigneeRole === 'franchise_partner') {
      throw new Error('Tasks cannot be assigned to partners.')
    }
    if (role === 'associate' && assigneeRole !== 'associate') {
      throw new Error('Associates can only assign tasks to themselves or other associates.')
    }
  }

  const { error } = await supabase.from('tasks').insert({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    assignee_id: assigneeId,
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'Medium',
    status: 'To Do',
    created_by: userId,
    org_id: orgId,
  })

  if (error) throw error
  // No revalidatePath — router.refresh() in TaskBoard handles the UI.
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])

  // Stamp completion time on Done; clear it when reopened.
  const completed_at = status === 'Done' ? new Date().toISOString() : null
  await supabase.from('tasks').update({ status, completed_at }).eq('id', taskId)

  // Two-way sync: anyone who's ported this task into their personal to-do list sees it flip too.
  await supabase.from('personal_todos').update({ done: status === 'Done', done_at: completed_at }).eq('linked_task_id', taskId)

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/my-todos')
}

export async function pushTask(taskId: string, newDate: string) {
  const { supabase, userId } = await requireRole(['founder', 'admin', 'associate'])

  // Only the assignee may push their own task.
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, push_count')
    .eq('id', taskId)
    .single()
  if (!task) throw new Error('Task not found.')
  if (task.assignee_id !== userId) throw new Error('Only the assignee can push this task.')

  const { error } = await supabase
    .from('tasks')
    .update({
      pushed_date: newDate,
      pushed_at: new Date().toISOString(),
      push_count: (task.push_count ?? 0) + 1,
    })
    .eq('id', taskId)
  if (error) throw error
  revalidatePath('/tasks')
}

// ── Comment thread ───────────────────────────────────────────────────────────

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  const { data } = await supabase
    .from('task_comments')
    .select('*, author:author_id(name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as TaskComment[]
}

export async function addTaskComment(taskId: string, body: string) {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin', 'associate'])
  const text = body.trim()
  if (!text) throw new Error('Comment cannot be empty.')
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, org_id: orgId, body: text, author_id: userId })
  if (error) throw error
  revalidatePath('/tasks')
}

export async function deleteTaskComment(id: string) {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  const { error } = await supabase.from('task_comments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/tasks')
}
