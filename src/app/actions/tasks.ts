'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { Task, TaskComment } from '@/lib/types'

const TASK_SELECT = '*, assignee:assignee_id(name, photo_url), created_by_user:created_by(name, photo_url), assigned_by_user:assigned_by_id(name, photo_url), company:company_id(id, name), desk_deal:desk_deal_id(id, company_name)'

export async function createTask(formData: FormData): Promise<Task> {
  const { supabase, userId, orgId, role } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])

  const assigneeId = formData.get('assignee_id') as string
  if (!assigneeId) throw new UserFacingError('Please choose who this task is assigned to.')

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
      throw new UserFacingError('Tasks cannot be assigned to partners.')
    }
    if (
      (role === 'associate' || role === 'general' || role === 'hr')
      && assigneeRole !== 'associate' && assigneeRole !== 'general' && assigneeRole !== 'hr'
    ) {
      throw new UserFacingError('Associates can only assign tasks to themselves or other associates.')
    }
  }

  const { data, error } = await supabase.from('tasks').insert({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    assignee_id: assigneeId,
    assigned_by_id: (formData.get('assigned_by_id') as string) || userId,
    company_id: (formData.get('company_id') as string) || null,
    desk_deal_id: (formData.get('desk_deal_id') as string) || null,
    link_url: (formData.get('link_url') as string)?.trim() || null,
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'Medium',
    status: 'To Do',
    created_by: userId,
    org_id: orgId,
  }).select(TASK_SELECT).single()

  if (error) throw error
  // No revalidatePath — TaskBoard adds the returned task to local state directly.
  return data as unknown as Task
}

export async function updateTask(taskId: string, formData: FormData): Promise<Task> {
  const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])

  const { data: existing } = await supabase
    .from('tasks')
    .select('created_by, assigned_by_id, assignee_id')
    .eq('id', taskId)
    .single()
  if (!existing) throw new UserFacingError('Task not found.')

  // Editable by whoever has a stake in the task, not just its assignee (contrast pushTask).
  const canEdit = ['founder', 'admin'].includes(role)
    || existing.created_by === userId
    || existing.assigned_by_id === userId
    || existing.assignee_id === userId
  if (!canEdit) throw new UserFacingError('You can only edit tasks you created, assigned, or are assigned to.')

  const assigneeId = formData.get('assignee_id') as string
  if (!assigneeId) throw new UserFacingError('Please choose who this task is assigned to.')

  // Same assignment rules as createTask. (RLS double-guards these.)
  if (assigneeId !== userId) {
    const { data: assignee } = await supabase
      .from('users')
      .select('role')
      .eq('id', assigneeId)
      .single()
    const assigneeRole = assignee?.role
    if (assigneeRole === 'franchise_partner') {
      throw new UserFacingError('Tasks cannot be assigned to partners.')
    }
    if (
      (role === 'associate' || role === 'general' || role === 'hr')
      && assigneeRole !== 'associate' && assigneeRole !== 'general' && assigneeRole !== 'hr'
    ) {
      throw new UserFacingError('Associates can only assign tasks to themselves or other associates.')
    }
  }

  const { data, error } = await supabase.from('tasks').update({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    assignee_id: assigneeId,
    company_id: (formData.get('company_id') as string) || null,
    desk_deal_id: (formData.get('desk_deal_id') as string) || null,
    link_url: (formData.get('link_url') as string)?.trim() || null,
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'Medium',
  }).eq('id', taskId).select(TASK_SELECT).single()

  if (error) throw error
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/my-todos')
  return data as unknown as Task
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])

  // Stamp completion time on Done; clear it when reopened.
  const completed_at = status === 'Done' ? new Date().toISOString() : null
  await supabase.from('tasks').update({ status, completed_at }).eq('id', taskId)

  // Two-way sync: anyone who's ported this task into their personal to-do list sees it flip too.
  await supabase.from('personal_todos').update({ done: status === 'Done', done_at: completed_at }).eq('linked_task_id', taskId)

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/my-todos')
}

export type PushTaskInput = {
  reason: string
  blockedExternal?: boolean
  blockedByUserId?: string | null
}

export async function pushTask(taskId: string, newDate: string, input: PushTaskInput) {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  // Validated here, not just in the modal — the reason is the whole point of the change, and a
  // client-side-only check would leave the KPI silently full of blank reasons.
  const reason = input.reason?.trim()
  if (!reason) throw new UserFacingError('A reason is required to push a task.')

  // Only the assignee may push their own task.
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, push_count, pushed_date, due_date')
    .eq('id', taskId)
    .single()
  if (!task) throw new UserFacingError('Task not found.')
  if (task.assignee_id !== userId) throw new UserFacingError('Only the assignee can push this task.')

  const fromDate = task.pushed_date ?? task.due_date ?? null

  const { error } = await supabase
    .from('tasks')
    .update({
      pushed_date: newDate,
      pushed_at: new Date().toISOString(),
      push_count: (task.push_count ?? 0) + 1,
    })
    .eq('id', taskId)
  if (error) throw error

  const blockedBy = input.blockedByUserId || null
  const { error: pushErr } = await supabase.from('task_pushes').insert({
    org_id: orgId,
    task_id: taskId,
    pushed_by: userId,
    from_date: fromDate,
    to_date: newDate,
    reason,
    blocked_external: input.blockedExternal ?? false,
    blocked_by_user_id: blockedBy,
  })
  if (pushErr) throw pushErr

  // Mirror the reason into the task's comment thread so it's visible where people already look,
  // rather than only inside the KPI aggregate. Non-fatal: the push itself already succeeded, and
  // failing here would misleadingly report the push as failed.
  try {
    const tags: string[] = []
    if (input.blockedExternal) tags.push('external dependency')
    if (blockedBy) {
      const { data: blocker } = await supabase.from('users').select('name').eq('id', blockedBy).single()
      tags.push(`waiting on ${blocker?.name ?? 'a colleague'}`)
    }
    const suffix = tags.length ? ` (${tags.join(', ')})` : ''
    await supabase.from('task_comments').insert({
      task_id: taskId,
      org_id: orgId,
      author_id: userId,
      body: `⤳ Pushed to ${newDate} — ${reason}${suffix}`,
    })
  } catch { /* comment is a courtesy; never fail the push over it */ }

  revalidatePath('/tasks')
}

export async function deleteTask(taskId: string) {
  const { supabase } = await requireRole(['founder', 'admin'])
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/my-todos')
}

// ── Comment thread ───────────────────────────────────────────────────────────

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
  const { data } = await supabase
    .from('task_comments')
    .select('*, author:author_id(name, photo_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as TaskComment[]
}

export async function addTaskComment(taskId: string, body: string) {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
  const text = body.trim()
  if (!text) throw new UserFacingError('Comment cannot be empty.')
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, org_id: orgId, body: text, author_id: userId })
  if (error) throw error
  revalidatePath('/tasks')
}

export async function deleteTaskComment(id: string) {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
  const { error } = await supabase.from('task_comments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/tasks')
}
