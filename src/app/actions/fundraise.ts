'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { FundraiseEventKind, FundraiseStatus } from '@/lib/types'

/* The Fundraise Status List.
 *
 * Associate-level work — §12 — so associates have the same access as founders and admins here.
 * RLS enforces that independently; these guards exist so a refusal is a readable sentence rather
 * than a silent zero-row write.
 */

async function requireDeskUser() {
  return requireRole(['founder', 'admin', 'associate'])
}

/** Pull every fund the founder approved onto the status list. Idempotent — safe to run again. */
export async function syncFromInvestorList(investorListId: string, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .rpc('sync_fundraise_from_investor_list', { p_list_id: investorListId })
  if (error) throw new Error(error.message)
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
  return (data as number) ?? 0
}

/**
 * Move a fund to a new status.
 *
 * The status change *is* a timeline event — written here rather than left to the caller, so the
 * history can never be missing the thing that matters most. status_changed_at moves with it, which
 * is what resets the ghosting clock; a comment deliberately does not.
 */
export async function setFundraiseStatus(input: {
  entryId: string
  status: FundraiseStatus
  note?: string
  /** Required when moving to 'rejected'. */
  rejectionReason?: string
  rejectionSector?: string | null
  /** Whether the founder sees the accompanying note. The status itself is always visible to them. */
  founderVisible?: boolean
  activeDealId: string
}) {
  const ctx = await requireDeskUser()

  if (input.status === 'rejected' && !input.rejectionReason?.trim()) {
    throw new UserFacingError(
      'A rejection needs its reason — it is what tells us, and the founder, what actually happened, '
      + 'and it is what enriches the fund\'s profile for next time.',
    )
  }

  const { data: entry } = await ctx.supabase
    .from('fundraise_entries')
    .select('id, org_id, status')
    .eq('id', input.entryId)
    .maybeSingle()
  if (!entry) throw new UserFacingError('That fund is no longer on this list.')
  const current = entry as { id: string; org_id: string; status: FundraiseStatus }

  if (current.status === input.status && !input.note?.trim()) {
    throw new UserFacingError(`Already ${input.status.replace(/_/g, ' ')}.`)
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: input.status,
    status_changed_at: now,
    rejection_reason: input.status === 'rejected' ? input.rejectionReason?.trim() : null,
    rejection_sector: input.status === 'rejected' ? (input.rejectionSector ?? null) : null,
  }
  // The first send is worth its own timestamp: it is the start of the conversation, and the
  // ghosting clock resets on every later change.
  if (input.status === 'deal_sent') patch.sent_at = now

  const { data: updated, error } = await ctx.supabase
    .from('fundraise_entries')
    .update(patch)
    .eq('id', input.entryId)
    .select('id')
  if (error) throw new Error(error.message)
  // An RLS-filtered update reports success having changed nothing.
  if (!updated || updated.length === 0) throw new UserFacingError('That fund could not be updated.')

  await ctx.supabase.from('fundraise_events').insert({
    org_id: current.org_id,
    entry_id: input.entryId,
    kind: 'status_change',
    from_status: current.status,
    to_status: input.status,
    body: input.status === 'rejected'
      ? [input.rejectionReason?.trim(), input.note?.trim()].filter(Boolean).join('\n\n')
      : input.note?.trim() || null,
    // A rejection reason is always the founder's to see — §6 says so explicitly.
    founder_visible: input.status === 'rejected' ? true : (input.founderVisible ?? false),
    created_by: ctx.userId,
  })

  revalidatePath(`/active-deals/${input.activeDealId}/fundraise`)
}

/** Log anything else that happened: outreach, a follow-up, a request, their reply, a note. */
export async function addFundraiseEvent(input: {
  entryId: string
  kind: Exclude<FundraiseEventKind, 'status_change' | 'founder_comment'>
  body: string
  founderVisible?: boolean
  activeDealId: string
}) {
  const ctx = await requireDeskUser()
  const body = input.body.trim()
  if (!body) throw new UserFacingError('Write something first.')

  const { data: entry } = await ctx.supabase
    .from('fundraise_entries').select('org_id').eq('id', input.entryId).maybeSingle()
  if (!entry) throw new UserFacingError('That fund is no longer on this list.')

  // Deliberately does not touch status_changed_at. Talking about a fund among ourselves must not
  // make a silent one look alive.
  const { error } = await ctx.supabase.from('fundraise_events').insert({
    org_id: (entry as { org_id: string }).org_id,
    entry_id: input.entryId,
    kind: input.kind,
    body,
    founder_visible: input.founderVisible ?? false,
    created_by: ctx.userId,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/active-deals/${input.activeDealId}/fundraise`)
}

/** Show or hide one event from the founder, after the fact. */
export async function setEventFounderVisible(eventId: string, visible: boolean, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .from('fundraise_events')
    .update({ founder_visible: visible })
    .eq('id', eventId)
    .neq('kind', 'founder_comment')   // theirs to begin with; not ours to hide
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That update could not be changed.')
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
}

/** The outreach email the team agreed for this mandate. */
export async function setReachoutTemplate(listId: string, template: string, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .from('fundraise_lists')
    .update({ reachout_template: template.trim() || null })
    .eq('id', listId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That list could not be updated.')
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
}

/** Share the list with the founder. Until this is set, the public link returns nothing. */
export async function shareFundraiseList(listId: string, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .from('fundraise_lists')
    .update({ shared_at: new Date().toISOString() })
    .eq('id', listId)
    .select('share_token')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That list could not be shared.')
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
  return (data[0] as { share_token: string }).share_token
}

/** Withdraw the link. The founder's comments stay; only their access ends. */
export async function unshareFundraiseList(listId: string, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { error } = await ctx.supabase
    .from('fundraise_lists').update({ shared_at: null }).eq('id', listId)
  if (error) throw new Error(error.message)
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
}

// ─── Getting to a contact, before the workflow starts ────────────────────────
// §9: where we hold no reachable person at a fund, the deal has not really been sent however good
// the list looks. This is the part that makes "we approached 40 funds" mean something.

/**
 * Record that a contact has been established, and who established it.
 *
 * Writes the person onto the fund's profile as well, because a POC that exists only inside one
 * mandate is one the next mandate has to find again.
 */
export async function establishPoc(input: {
  entryId: string
  investorId: string
  name: string
  role?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  activeDealId: string
}) {
  const ctx = await requireDeskUser()
  const name = input.name.trim()
  if (!name) throw new UserFacingError('Who did you reach?')

  const { data: entry } = await ctx.supabase
    .from('fundraise_entries').select('org_id, status').eq('id', input.entryId).maybeSingle()
  if (!entry) throw new UserFacingError('That fund is no longer on this list.')
  const e = entry as { org_id: string; status: string }

  // Primary, because it is now the way in. Any incumbent primary is demoted first — two primaries
  // is the state where nobody knows who to call.
  await ctx.supabase
    .from('investor_contacts')
    .update({ rank: 'secondary' })
    .eq('investor_id', input.investorId)
    .eq('rank', 'primary')

  const { data: contact, error: contactErr } = await ctx.supabase
    .from('investor_contacts')
    .insert({
      investor_id: input.investorId,
      name,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      rank: 'primary',
      employment_status: 'active',
      last_verified_at: new Date().toISOString(),
      contacted_by_user_id: ctx.userId,
    })
    .select('id')
    .single()
  if (contactErr) throw new Error(contactErr.message)

  const now = new Date().toISOString()
  const { data: updated, error } = await ctx.supabase
    .from('fundraise_entries')
    .update({
      status: 'converted_poc',
      status_changed_at: now,
      poc_established_by: ctx.userId,
      poc_established_at: now,
    })
    .eq('id', input.entryId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!updated || updated.length === 0) throw new UserFacingError('That fund could not be updated.')

  await ctx.supabase.from('fundraise_events').insert({
    org_id: e.org_id,
    entry_id: input.entryId,
    kind: 'status_change',
    from_status: e.status,
    to_status: 'converted_poc',
    body: `Contact established: ${name}${input.role ? `, ${input.role}` : ''}. Added to the fund's profile as primary.`,
    founder_visible: false,
    created_by: ctx.userId,
  })

  revalidatePath(`/active-deals/${input.activeDealId}/fundraise`)
  return (contact as { id: string }).id
}

/**
 * Tag a fund's contact as somebody's connection.
 *
 * On the contact rather than the fund: a fund has several people at it, and only one of them is
 * Monica's. Putting it on the fund would lose which relationship it actually is — and the partner
 * attribution here is what fees are eventually calculated from (§11).
 */
export async function setContactConnection(input: {
  contactId: string
  connectedFounder?: string | null
  connectedPartnerId?: string | null
  activeDealId?: string
}) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .from('investor_contacts')
    .update({
      connected_founder: input.connectedFounder || null,
      connected_partner_id: input.connectedPartnerId || null,
    })
    .eq('id', input.contactId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That contact could not be updated.')
  if (input.activeDealId) revalidatePath(`/active-deals/${input.activeDealId}/fundraise`)
}

/** Which introduction route a fund is on, so the pre-workflow statuses mean something specific. */
export async function setIntroRoute(entryId: string, route: string | null, activeDealId: string) {
  const ctx = await requireDeskUser()
  const { data, error } = await ctx.supabase
    .from('fundraise_entries')
    .update({ intro_route: route })
    .eq('id', entryId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new UserFacingError('That fund could not be updated.')
  revalidatePath(`/active-deals/${activeDealId}/fundraise`)
}
