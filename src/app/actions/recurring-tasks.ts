'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { addRecurrenceInterval } from '@/lib/recurrence'
import type { RecurrenceType } from '@/lib/types'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}
async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}

export type RecurringTaskInput = {
  title: string
  description?: string | null
  link_url?: string | null
  recurrence_type: RecurrenceType
  lead_days?: number
  assignee_id?: string | null
  next_due_date: string
}

export async function createRecurringTask(input: RecurringTaskInput): Promise<string> {
  const { supabase, userId, orgId } = await requireAdmin()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (!input.next_due_date) throw new Error('A first due date is required.')

  const { data, error } = await supabase
    .from('recurring_tasks')
    .insert({
      org_id: orgId,
      created_by: userId,
      title,
      description: input.description?.trim() || null,
      link_url: input.link_url?.trim() || null,
      recurrence_type: input.recurrence_type,
      lead_days: input.lead_days ?? 2,
      assignee_id: input.assignee_id || null,
      next_due_date: input.next_due_date,
    })
    .select('id')
    .single()
  if (error) throw error
  revalidatePath('/tasks/recurring')
  return data.id as string
}

export async function updateRecurringTask(id: string, patch: Partial<RecurringTaskInput>): Promise<void> {
  const { supabase } = await requireAdmin()
  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new Error('Title is required.')
    update.title = title
  }
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.link_url !== undefined) update.link_url = patch.link_url?.trim() || null
  if (patch.recurrence_type !== undefined) update.recurrence_type = patch.recurrence_type
  if (patch.lead_days !== undefined) update.lead_days = patch.lead_days
  if (patch.assignee_id !== undefined) update.assignee_id = patch.assignee_id || null
  if (patch.next_due_date !== undefined) update.next_due_date = patch.next_due_date

  const { error } = await supabase.from('recurring_tasks').update(update).eq('id', id)
  if (error) throw error
  revalidatePath('/tasks/recurring')
}

export async function deleteRecurringTask(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('recurring_tasks').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/tasks/recurring')
}

export async function setRecurringTaskActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('recurring_tasks').update({ active }).eq('id', id)
  if (error) throw error
  revalidatePath('/tasks/recurring')
}

/**
 * Tick off the current occurrence: logs who completed it, then advances next_due_date by one
 * recurrence interval — measured from the due date, not today, so the cadence (e.g. "every
 * Saturday") never drifts even if it was completed late.
 */
export async function completeRecurringTask(id: string): Promise<void> {
  const { supabase, userId } = await requireInternal()
  const { data: task, error: readErr } = await supabase
    .from('recurring_tasks')
    .select('next_due_date, recurrence_type, org_id')
    .eq('id', id)
    .single()
  if (readErr || !task) throw new Error('Recurring task not found.')

  const { error: logErr } = await supabase.from('recurring_task_completions').insert({
    recurring_task_id: id,
    org_id: task.org_id,
    occurrence_date: task.next_due_date,
    completed_by: userId,
  })
  if (logErr) {
    // Someone else already ticked this exact occurrence (unique constraint) — nothing more to do.
    if (logErr.code === '23505') { revalidatePath('/tasks/recurring'); return }
    throw logErr
  }

  const nextDue = addRecurrenceInterval(task.next_due_date as string, task.recurrence_type as RecurrenceType)
  const { error: advErr } = await supabase.from('recurring_tasks').update({ next_due_date: nextDue }).eq('id', id)
  if (advErr) throw advErr

  revalidatePath('/tasks/recurring')
  revalidatePath('/dashboard')
}
