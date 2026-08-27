'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { PersonalTodo } from '@/lib/types'

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

export async function getMyTodos(): Promise<PersonalTodo[]> {
  const { supabase, userId } = await requireInternal()
  const { data } = await supabase
    .from('personal_todos')
    .select('*, linked_task:linked_task_id(id, title, status, due_date)')
    .eq('user_id', userId)
    .order('done', { ascending: true })
    .order('position', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as PersonalTodo[]
}

export async function addPersonalTodo(input: {
  title: string
  notes?: string | null
  due_date?: string | null
  /** Monday of the work week this belongs to. Setting it also publishes the item to that week's update. */
  work_week_start?: string | null
}): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()
  const title = input.title.trim()
  if (!title) throw new UserFacingError('Title is required.')
  const { data, error } = await supabase
    .from('personal_todos')
    .insert({
      user_id: userId, org_id: orgId, title,
      notes: input.notes?.trim() || null,
      due_date: input.due_date || null,
      work_week_start: input.work_week_start || null,
    })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
  revalidatePath('/tasks/update')
  return data.id as string
}

export async function updatePersonalTodo(id: string, patch: {
  title?: string
  notes?: string | null
  due_date?: string | null
  work_week_start?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new UserFacingError('Title is required.')
    update.title = title
  }
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null
  if (patch.due_date !== undefined) update.due_date = patch.due_date || null
  if (patch.work_week_start !== undefined) update.work_week_start = patch.work_week_start || null
  const { error } = await supabase.from('personal_todos').update(update).eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
  revalidatePath('/tasks/update')
}

export async function deletePersonalTodo(id: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('personal_todos').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
}

/**
 * Toggle a personal to-do's done state. If it's linked to a shared Task, this also flips the
 * Task's status (two-way sync) — best-effort: if the user lacks permission to update that
 * particular task (RLS), the personal item still saves.
 */
export async function togglePersonalTodo(id: string, done: boolean): Promise<void> {
  const { supabase, userId } = await requireInternal()
  const done_at = done ? new Date().toISOString() : null

  const { data: row, error } = await supabase
    .from('personal_todos')
    .update({ done, done_at })
    .eq('id', id)
    .eq('user_id', userId)
    .select('linked_task_id')
    .single()
  if (error) throw dbFailure('save that', error)

  if (row?.linked_task_id) {
    try { await supabase.from('tasks').update({ status: done ? 'Done' : 'To Do', completed_at: done_at }).eq('id', row.linked_task_id) }
    catch { /* non-fatal: RLS may block updating a task that isn't this user's */ }
  }

  revalidatePath('/my-todos')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/tasks/update')
}

/** Port an existing Task into the caller's personal list, linked for two-way completion sync. */
export async function portTaskIn(taskId: string): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()

  const { data: task, error: taskErr } = await supabase.from('tasks').select('title, status, due_date').eq('id', taskId).single()
  if (taskErr || !task) throw new UserFacingError('Task not found.')

  // Already ported — return the existing row instead of erroring on the unique constraint.
  const { data: existing } = await supabase.from('personal_todos').select('id').eq('user_id', userId).eq('linked_task_id', taskId).maybeSingle()
  if (existing) return existing.id as string

  const { data, error } = await supabase
    .from('personal_todos')
    .insert({
      user_id: userId, org_id: orgId, title: task.title, linked_task_id: taskId,
      done: task.status === 'Done', done_at: task.status === 'Done' ? new Date().toISOString() : null,
      due_date: task.due_date,
    })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
  return data.id as string
}

/** Detach a personal item from its linked Task, keeping it as a standalone item. */
export async function unlinkPersonalTodo(id: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('personal_todos').update({ linked_task_id: null }).eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
}
