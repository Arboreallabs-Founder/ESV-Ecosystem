'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { siteUrl } from '@/lib/site-url'

/**
 * Investor lists — the shortlist a founder approves before we approach anyone.
 *
 * The database enforces the two rules that matter (IB deals only, funds only) with triggers, so
 * these actions can fail loudly rather than silently allowing something the UI meant to prevent.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}

function revalidate(dealId: string) {
  revalidatePath(`/active-deals/${dealId}`)
  revalidatePath(`/active-deals/${dealId}/investor-lists`)
}

export async function createInvestorList(activeDealId: string, name: string): Promise<string> {
  const { supabase, orgId, userId } = await requireInternal()
  const title = name.trim()
  if (!title) throw new Error('Give the list a name.')

  const { data, error } = await supabase
    .from('investor_lists')
    .insert({ org_id: orgId, active_deal_id: activeDealId, name: title, created_by: userId })
    .select('id')
    .single()
  // The trigger message is written for a person, so pass it through rather than replacing it.
  if (error) throw new Error(error.message)
  revalidate(activeDealId)
  return data.id as string
}

export async function addInvestorsToList(listId: string, investorIds: string[]): Promise<number> {
  const { supabase, orgId } = await requireInternal()
  if (investorIds.length === 0) return 0

  const { data: list, error: lErr } = await supabase
    .from('investor_lists').select('id, active_deal_id, status').eq('id', listId).single()
  if (lErr) throw lErr
  if (list.status !== 'draft') {
    throw new Error('This list has already been shared. Reopen it before changing who is on it.')
  }

  const { data: existing } = await supabase
    .from('investor_list_items').select('investor_id').eq('list_id', listId)
  const have = new Set((existing ?? []).map((r: any) => r.investor_id))
  const fresh = investorIds.filter((id) => !have.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase.from('investor_list_items').insert(
    fresh.map((id, i) => ({
      org_id: orgId, list_id: listId, investor_id: id, sort_order: have.size + i,
    })),
  )
  if (error) throw new Error(error.message)
  revalidate(list.active_deal_id as string)
  return fresh.length
}

export async function removeInvestorFromList(itemId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_list_items').delete().eq('id', itemId)
    .select('list:investor_lists!list_id(active_deal_id)')
  if (error) throw error
  const l = Array.isArray((data?.[0] as any)?.list) ? (data![0] as any).list[0] : (data?.[0] as any)?.list
  if (l?.active_deal_id) revalidate(l.active_deal_id)
}

/** Publish the list and get the founder's link. */
export async function shareInvestorList(listId: string, introNote: string): Promise<string> {
  const { supabase } = await requireInternal()

  const { data: items } = await supabase
    .from('investor_list_items').select('id').eq('list_id', listId).limit(1)
  if (!items?.length) throw new Error('Add at least one fund before sharing this list.')

  const { data, error } = await supabase
    .from('investor_lists')
    .update({
      status: 'shared',
      shared_at: new Date().toISOString(),
      intro_note: introNote.trim() || null,
    })
    .eq('id', listId)
    .select('share_token, active_deal_id')
    .single()
  if (error) throw error
  revalidate(data.active_deal_id as string)
  return `${siteUrl()}/il/${data.share_token}`
}

/** Pull the link. Anyone holding it gets an error page from here on. */
export async function unshareInvestorList(listId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_lists')
    .update({ status: 'draft' })
    .eq('id', listId)
    .select('active_deal_id')
    .single()
  if (error) throw error
  revalidate(data.active_deal_id as string)
}

/**
 * Link a founder's free-text exclusion to a fund we hold.
 *
 * This is the step that turns "they said not to contact Blume" into something the outreach can
 * actually be checked against, so it is done by us rather than guessed by a string match.
 */
export async function matchExclusion(exclusionId: string, investorId: string | null): Promise<void> {
  const { supabase, userId } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_list_exclusions')
    .update({
      investor_id: investorId,
      matched_by: investorId ? userId : null,
      matched_at: investorId ? new Date().toISOString() : null,
    })
    .eq('id', exclusionId)
    .select('list:investor_lists!list_id(active_deal_id)')
  if (error) throw error
  const l = Array.isArray((data?.[0] as any)?.list) ? (data![0] as any).list[0] : (data?.[0] as any)?.list
  if (l?.active_deal_id) revalidate(l.active_deal_id)
}

export async function setItemInternalNote(itemId: string, note: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase
    .from('investor_list_items')
    .update({ internal_note: note.trim() || null })
    .eq('id', itemId)
  if (error) throw error
}

export async function renameInvestorList(listId: string, name: string): Promise<void> {
  const { supabase } = await requireInternal()
  const title = name.trim()
  if (!title) throw new Error('A list needs a name.')

  const { data, error } = await supabase
    .from('investor_lists')
    .update({ name: title })
    .eq('id', listId)
    .select('active_deal_id')
    .single()
  if (error) throw error
  revalidate(data.active_deal_id as string)
}

/**
 * Delete a list.
 *
 * A list the founder has already answered is a record of what they told us, so deleting it needs
 * saying out loud rather than being a quiet click — the caller passes `force` once the user has
 * confirmed. Items and exclusions go with it via ON DELETE CASCADE.
 */
export async function deleteInvestorList(listId: string, force = false): Promise<void> {
  const { supabase } = await requireInternal()

  const { data: list, error: lErr } = await supabase
    .from('investor_lists').select('active_deal_id, responded_at').eq('id', listId).single()
  if (lErr) throw lErr
  if (list.responded_at && !force) {
    throw new Error('The founder has answered this list. Deleting it discards their answer.')
  }

  const { error } = await supabase.from('investor_lists').delete().eq('id', listId)
  if (error) throw error
  revalidate(list.active_deal_id as string)
}
