'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { ANGEL_METHOD_LABELS, type AngelMethod } from '@/lib/types'

/* Angel Reachout: creating a list, working it, and recording what came back.
 *
 * Internal only (§13). Syndicate deals are our own angel network — there is no founder-facing side
 * to this at all, which is the main way it differs from the fundraise status list.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}

/**
 * Start a reachout.
 *
 * Every angel starts ticked (§15) — the list is something you narrow, not something you build. One
 * collaborative task is created for the whole list rather than one per investor, so several people
 * can work the same list and tick people off as they go.
 */
export async function createAngelReachout(input: {
  activeDealId: string
  method: AngelMethod
  methodOther?: string | null
  title?: string | null
  assignees: string[]
}) {
  const ctx = await requireInternal()

  // "Other" with no detail is a record of nothing — in three months nobody will remember what it
  // meant, which defeats the point of logging the method at all.
  if (input.method === 'other' && !input.methodOther?.trim()) {
    throw new Error('Say what the method was — "other" on its own tells nobody anything later.')
  }

  const { data: me } = await ctx.supabase
    .from('users').select('org_id').eq('id', ctx.userId).maybeSingle()
  const orgId = (me as { org_id?: string } | null)?.org_id

  const label = input.method === 'other'
    ? input.methodOther!.trim()
    : ANGEL_METHOD_LABELS[input.method]
  const title = input.title?.trim() || `Angel reachout — ${label}`

  // The task first: a list with no task is invisible, whereas a task with no list is obvious and
  // recoverable. Assigned to the first person named; the rest work it through the list itself.
  const { data: task, error: taskErr } = await ctx.supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      title,
      description: 'Collaborative angel reachout. Tick each investor off as you reach them, and '
        + 'record what they said next to their name.',
      assignee_id: input.assignees[0] ?? null,
      assigned_by_id: ctx.userId,
      created_by: ctx.userId,
      status: 'To Do',
      priority: 'Medium',
    })
    .select('id')
    .single()
  if (taskErr) throw new Error(taskErr.message)

  const { data: list, error } = await ctx.supabase
    .from('angel_reachout_lists')
    .insert({
      org_id: orgId,
      active_deal_id: input.activeDealId,
      method: input.method,
      method_other: input.method === 'other' ? input.methodOther!.trim() : null,
      title,
      task_id: (task as { id: string }).id,
      created_by: ctx.userId,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const listId = (list as { id: string }).id
  const { error: seedErr } = await ctx.supabase.rpc('seed_angel_reachout', { p_list_id: listId })
  if (seedErr) throw new Error(seedErr.message)

  revalidatePath(`/active-deals/${input.activeDealId}/angels`)
  return listId
}

/** Untick someone you are not reaching out to on this round. */
export async function setAngelIncluded(memberId: string, included: boolean, activeDealId: string) {
  const ctx = await requireInternal()
  const { data, error } = await ctx.supabase
    .from('angel_reachout_members')
    .update({ included })
    .eq('id', memberId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('That investor could not be updated.')
  revalidatePath(`/active-deals/${activeDealId}/angels`)
}

/**
 * Tick someone off as reached.
 *
 * Records who did it, because the whole point of a collaborative list is that several people work
 * it — and "who spoke to them" is the first question anyone asks afterwards.
 */
export async function setAngelDone(memberId: string, done: boolean, activeDealId: string) {
  const ctx = await requireInternal()
  const { data, error } = await ctx.supabase
    .from('angel_reachout_members')
    .update({
      done,
      done_by: done ? ctx.userId : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq('id', memberId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('That investor could not be updated.')
  revalidatePath(`/active-deals/${activeDealId}/angels`)
}

/** What they said. Free text, because an angel's reply does not fit a status. */
export async function setAngelResponse(memberId: string, response: string, activeDealId: string) {
  const ctx = await requireInternal()
  const text = response.trim()
  const { data, error } = await ctx.supabase
    .from('angel_reachout_members')
    .update({
      response: text || null,
      responded_at: text ? new Date().toISOString() : null,
    })
    .eq('id', memberId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('That response could not be saved.')
  revalidatePath(`/active-deals/${activeDealId}/angels`)
}

/**
 * Move an angel who has committed into the deal's investor list.
 *
 * §18: a commitment belongs in the same place as every other one on the deal, so the totals on the
 * deal page stay true. Reached from here because this is where you are when they say yes.
 */
export async function commitAngelToDeal(input: {
  memberId: string
  investorId: string
  activeDealId: string
  amount: number
}) {
  const ctx = await requireInternal()
  if (!(input.amount > 0)) throw new Error('How much are they in for?')

  const { data: existing } = await ctx.supabase
    .from('active_deal_investors')
    .select('id')
    .eq('active_deal_id', input.activeDealId)
    .eq('investor_id', input.investorId)
    .maybeSingle()

  if (existing) {
    throw new Error('They are already on this deal’s investor list — edit the amount there.')
  }

  const { error } = await ctx.supabase.from('active_deal_investors').insert({
    active_deal_id: input.activeDealId,
    investor_id: input.investorId,
    is_investing: true,
    investment_amount: input.amount,
    status: 'commitment_received',
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/active-deals/${input.activeDealId}/angels`)
  revalidatePath(`/active-deals/${input.activeDealId}`)
}
