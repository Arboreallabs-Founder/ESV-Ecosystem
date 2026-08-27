'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

/* Automatic Tasks: completing one, and saying why it is stuck.
 *
 * Nobody owns them, so anyone internal can do either — which is the point. RLS enforces that
 * independently; these guards exist so a refusal is a readable sentence.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}

/** Mark one done. Anyone can, because it is the mandate's work rather than a person's. */
export async function completeAutomaticTask(taskId: string) {
  const ctx = await requireInternal()
  const { data, error } = await ctx.supabase
    .from('tasks')
    .update({ status: 'Done', completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('source', 'automatic')
    .select('id')
  if (error) throw new Error(error.message)
  // An RLS-filtered update reports success having changed nothing.
  if (!data || data.length === 0) throw new UserFacingError('That task could not be completed.')
  revalidatePath('/tasks/update')
}

/** Put one back. It will not be regenerated while it is open, so this is safe. */
export async function reopenAutomaticTask(taskId: string) {
  const ctx = await requireInternal()
  const { data, error } = await ctx.supabase
    .from('tasks')
    .update({ status: 'To Do', completed_at: null })
    .eq('id', taskId)
    .eq('source', 'automatic')
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That task could not be reopened.')
  revalidatePath('/tasks/update')
}

/**
 * Comment on one.
 *
 * The reason this exists: an automatic task is often blocked on something outside the team — the
 * fund has not replied, legal is sitting on the data — and being able to say so is what stops it
 * looking like nobody did the work.
 */
export async function commentOnAutomaticTask(taskId: string, body: string) {
  const ctx = await requireInternal()
  const text = body.trim()
  if (!text) throw new UserFacingError('Write something first.')

  const { data: task } = await ctx.supabase
    .from('tasks').select('org_id, source').eq('id', taskId).maybeSingle()
  if (!task || (task as { source: string }).source !== 'automatic') {
    throw new UserFacingError('That is not an automatic task.')
  }

  const { error } = await ctx.supabase.from('task_comments').insert({
    org_id: (task as { org_id: string }).org_id,
    task_id: taskId,
    body: text,
    author_id: ctx.userId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/tasks/update')
}
