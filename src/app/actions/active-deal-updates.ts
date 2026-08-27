'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { ActiveDealUpdate } from '@/lib/types'

/* The deal's "latest update" thread. Posted by whoever is running the mandate as news comes in;
   the newest entry is what the Weekly Update prints as `[Deal name]: [Latest Update]`. */

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr'] as const

const UPDATE_SELECT = '*, created_by_user:created_by(name, photo_url)'

export async function getDealUpdates(activeDealId: string): Promise<ActiveDealUpdate[]> {
  const { supabase } = await requireRole([...INTERNAL])
  const { data } = await supabase
    .from('active_deal_updates')
    .select(UPDATE_SELECT)
    .eq('active_deal_id', activeDealId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ActiveDealUpdate[]
}

export async function addDealUpdate(activeDealId: string, body: string): Promise<ActiveDealUpdate> {
  const { supabase, userId, orgId } = await requireRole([...INTERNAL])
  if (!orgId) throw new UserFacingError('No organization found for this account.')

  const text = body.trim()
  if (!text) throw new UserFacingError('An update cannot be empty.')

  // Posting rights (founder/admin, or an assignee on the deal's pipeline entry) are enforced by
  // the RLS policy rather than duplicated here — one source of truth, and it holds even if some
  // future caller forgets the check.
  const { data, error } = await supabase
    .from('active_deal_updates')
    .insert({ active_deal_id: activeDealId, org_id: orgId, body: text, created_by: userId })
    .select(UPDATE_SELECT)
    .single()
  if (error) throw dbFailure('save that', error)

  revalidatePath(`/active-deals/${activeDealId}`)
  revalidatePath('/tasks/update')
  return data as unknown as ActiveDealUpdate
}

export async function deleteDealUpdate(id: string, activeDealId: string) {
  const { supabase } = await requireRole([...INTERNAL])
  const { error } = await supabase.from('active_deal_updates').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath(`/active-deals/${activeDealId}`)
  revalidatePath('/tasks/update')
}
