'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

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
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
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
