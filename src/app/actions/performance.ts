'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

/** Only founder/admin set the scoring formula — HR can record adjustments but not change how
    everyone's score is calculated. */
async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

/** Founder/admin/hr can record a manual adjustment. */
async function requireScorer() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type WeightsInput = {
  kudos_received: number
  task_on_time: number
  task_overdue: number
  task_pushed: number
  recurring_completed: number
  event_attended: number
}

export async function updatePerformanceWeights(input: WeightsInput): Promise<void> {
  const { supabase, userId, orgId } = await requireAdmin()
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) throw new UserFacingError(`${key} must be a number.`)
  }

  const { error } = await supabase.from('performance_weights').upsert(
    { org_id: orgId, updated_by: userId, ...input },
    { onConflict: 'org_id' },
  )
  if (error) throw error
  revalidatePath('/analytics')
}

export type AdjustmentInput = {
  user_id: string
  points: number
  reason: string
  occurred_on: string
}

export async function createAdjustment(input: AdjustmentInput): Promise<void> {
  const { supabase, userId, orgId } = await requireScorer()
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  const reason = input.reason.trim()
  if (!reason) throw new UserFacingError('A reason is required.')
  if (!Number.isFinite(input.points) || input.points === 0) {
    throw new UserFacingError('Enter a non-zero number of points.')
  }
  if (!input.user_id) throw new UserFacingError('Choose who this applies to.')

  const { error } = await supabase.from('performance_adjustments').insert({
    org_id: orgId,
    user_id: input.user_id,
    points: input.points,
    reason,
    occurred_on: input.occurred_on || new Date().toISOString().slice(0, 10),
    created_by: userId,
  })
  if (error) throw error
  revalidatePath('/analytics')
}

export async function deleteAdjustment(id: string): Promise<void> {
  const { supabase } = await requireScorer()
  const { error } = await supabase.from('performance_adjustments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/analytics')
}
