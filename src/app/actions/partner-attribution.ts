'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { AttributionSource } from '@/lib/types'

/**
 * Partner attribution: proposing a claim, and the two signatures that make it real.
 *
 * Every route by which a partner can end up credited for something funnels through here — a form
 * submission, a manual submission, an investor referral, and an admin tagging a record after the
 * fact. They were four separate gestures writing the same column; they are one claim now, because
 * they are all the same statement about the same money.
 *
 * The database is what enforces this, not these functions. A trigger on companies and investors
 * refuses any change to referred_by_partner_id except from apply_partner_attribution(), which
 * checks for both signatures itself. These guards exist so a refusal arrives as a sentence someone
 * can act on rather than a Postgres error.
 */

async function requireCoordinator() {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  const { data } = await ctx.supabase
    .from('users')
    .select('is_sgp_coordinator, is_sgp_approver')
    .eq('id', ctx.userId)
    .maybeSingle()
  const flags = data as { is_sgp_coordinator?: boolean; is_sgp_approver?: boolean } | null
  if (!flags?.is_sgp_coordinator && !['founder', 'admin'].includes(ctx.role)) {
    throw new UserFacingError('Only an SGP Coordinator can decide partner attribution.')
  }
  return ctx
}

/**
 * The second signature. A flag rather than the founder role: "any founder" would make it whoever
 * opens the Desk first, and the whole point is that one named person signs the fee off.
 */
async function requireApprover() {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  const { data } = await ctx.supabase
    .from('users')
    .select('is_sgp_approver')
    .eq('id', ctx.userId)
    .maybeSingle()
  if (!(data as { is_sgp_approver?: boolean } | null)?.is_sgp_approver) {
    throw new UserFacingError('Only the founder approver can sign off partner attribution.')
  }
  return ctx
}

function revalidateSgp() {
  revalidatePath('/sgp-desk')
  revalidatePath('/my-companies')
  revalidatePath('/portal')
  revalidatePath('/companies')
  revalidatePath('/investors')
}

type Subject = { companyId: string; investorId?: never } | { investorId: string; companyId?: never }

/**
 * File a claim.
 *
 * A coordinator proposing counts as the first signature — they are the person the first signature
 * is meant to come from, and making them approve their own proposal on the next screen is
 * ceremony, not control. Anyone else's proposal starts a step earlier.
 */
export async function proposeAttribution(input: Subject & {
  partnerId: string
  source: AttributionSource
  note?: string | null
  referralId?: string | null
  pipelineEntryId?: string | null
}): Promise<string> {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  if (!ctx.orgId) throw new UserFacingError('No organisation in scope.')
  if (!input.partnerId) throw new UserFacingError('Choose which partner is being credited.')

  const { data: flagRow } = await ctx.supabase
    .from('users').select('is_sgp_coordinator').eq('id', ctx.userId).maybeSingle()
  const coordinates = !!(flagRow as { is_sgp_coordinator?: boolean } | null)?.is_sgp_coordinator
    || ['founder', 'admin'].includes(ctx.role)

  const now = new Date().toISOString()
  const { data, error } = await ctx.supabase
    .from('partner_attribution_claims')
    .insert({
      org_id: ctx.orgId,
      partner_id: input.partnerId,
      company_id: input.companyId ?? null,
      investor_id: input.investorId ?? null,
      source: input.source,
      referral_id: input.referralId ?? null,
      pipeline_entry_id: input.pipelineEntryId ?? null,
      note: input.note?.trim() || null,
      proposed_by: ctx.userId,
      status: coordinates ? 'pending_founder' : 'pending_coordinator',
      coordinator_by: coordinates ? ctx.userId : null,
      coordinator_at: coordinates ? now : null,
    })
    .select('id')
    .single()

  if (error) {
    // The partial unique index. Two partners claiming one relationship is a fee dispute that needs
    // a person, so it surfaces as a sentence rather than a constraint name.
    if (error.code === '23505') {
      throw new UserFacingError(
        'There is already a live claim on this one. Settle that before filing another — two partners '
        + 'claiming one relationship is a fee question, not a race.',
      )
    }
    throw dbFailure('save that', error)
  }

  revalidateSgp()
  return data.id as string
}

/** The coordinator's signature. Moves the claim to the founder, it does not credit anyone yet. */
export async function coordinatorApprove(claimId: string, note?: string | null): Promise<void> {
  const ctx = await requireCoordinator()
  const { data, error } = await ctx.supabase
    .from('partner_attribution_claims')
    .update({
      status: 'pending_founder',
      coordinator_by: ctx.userId,
      coordinator_at: new Date().toISOString(),
      coordinator_note: note?.trim() || null,
    })
    .eq('id', claimId)
    .eq('status', 'pending_coordinator')   // two coordinators at once: first wins, loudly
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) {
    throw new UserFacingError('That claim is no longer waiting on a coordinator. Reload to see where it got to.')
  }
  revalidateSgp()
}

/**
 * The founder's signature, and the only thing that actually credits a partner.
 *
 * Two steps, in this order: record the decision, then ask the database to apply it. If the second
 * fails the claim reads "approved" with no tag, which is visible and fixable. The other order
 * would tag a partner against a claim that was never recorded as approved.
 */
export async function founderApprove(claimId: string, note?: string | null): Promise<void> {
  const ctx = await requireApprover()

  const { data: claim } = await ctx.supabase
    .from('partner_attribution_claims')
    .select('coordinator_by, status')
    .eq('id', claimId)
    .maybeSingle()
  if (!claim) throw new UserFacingError('That claim could not be found.')
  const c = claim as { coordinator_by: string | null; status: string }
  if (c.status !== 'pending_founder') {
    throw new UserFacingError('That claim is not waiting on the founder. Reload to see where it got to.')
  }
  // Enforced in the database too; caught here so the message says what to do about it.
  if (c.coordinator_by && c.coordinator_by === ctx.userId) {
    throw new UserFacingError(
      'You approved this as the coordinator, so it needs a different person to sign it off. '
      + 'Two signatures from one person is one signature.',
    )
  }

  const { data, error } = await ctx.supabase
    .from('partner_attribution_claims')
    .update({
      status: 'approved',
      founder_by: ctx.userId,
      founder_at: new Date().toISOString(),
      founder_note: note?.trim() || null,
    })
    .eq('id', claimId)
    .eq('status', 'pending_founder')
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) {
    throw new UserFacingError('That claim was decided by someone else a moment ago. Reload to see the outcome.')
  }

  const { error: applyErr } = await ctx.supabase.rpc('apply_partner_attribution', { p_claim_id: claimId })
  if (applyErr) {
    throw new UserFacingError(
      `Approved, but the tag could not be applied: ${applyErr.message}. `
      + 'The claim is recorded as approved — reapply it from the Desk.',
    )
  }

  revalidateSgp()
}

/** Turn one down, at either step. The reason is required — it is what the partner is told. */
export async function rejectAttribution(claimId: string, reason: string): Promise<void> {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  const note = reason.trim()
  if (!note) throw new UserFacingError('Say why, so the partner knows where they stand.')

  const { data: claim } = await ctx.supabase
    .from('partner_attribution_claims')
    .select('status')
    .eq('id', claimId)
    .maybeSingle()
  if (!claim) throw new UserFacingError('That claim could not be found.')
  const status = (claim as { status: string }).status

  // Whichever step it is sitting at is the step allowed to refuse it.
  if (status === 'pending_coordinator') await requireCoordinator()
  else if (status === 'pending_founder') await requireApprover()
  else throw new UserFacingError('That claim has already been decided.')

  const { data, error } = await ctx.supabase
    .from('partner_attribution_claims')
    .update({ status: 'rejected', rejected_note: note })
    .eq('id', claimId)
    .eq('status', status)
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) {
    throw new UserFacingError('That claim was decided by someone else a moment ago. Reload to see the outcome.')
  }
  revalidateSgp()
}

/**
 * Sign off several at once.
 *
 * Built for the Monday call specifically: a queue that can only be cleared one modal at a time is
 * a queue that does not get cleared while six people wait. Each is applied independently so one
 * failure does not silently take the rest with it, and the failures come back named.
 */
export async function founderApproveMany(claimIds: string[]): Promise<{ approved: number; failed: Array<{ id: string; message: string }> }> {
  await requireApprover()
  const failed: Array<{ id: string; message: string }> = []
  let approved = 0
  for (const id of claimIds) {
    try { await founderApprove(id); approved++ }
    catch (e) { failed.push({ id, message: e instanceof Error ? e.message : 'Failed.' }) }
  }
  revalidateSgp()
  return { approved, failed }
}

/**
 * Reapply a claim whose tag did not land.
 *
 * The gap founderApprove leaves on purpose: approved in the ledger, untagged on the record. Rare,
 * but silent if there is no way to fix it, and a fee attribution that exists in one place and not
 * the other is exactly the kind of thing nobody notices until it is money.
 */
export async function reapplyAttribution(claimId: string): Promise<void> {
  const ctx = await requireApprover()
  const { error } = await ctx.supabase.rpc('apply_partner_attribution', { p_claim_id: claimId })
  if (error) throw dbFailure('save that', error)
  revalidateSgp()
}

/**
 * Take an approved attribution back off a record.
 *
 * Founder approver only, and it needs a reason. Removing credit is not the reverse of a mistake in
 * a form, it is a decision about money that somebody was told they had — so it takes the same
 * signature that granted it, and leaves the reason on the claim.
 */
export async function withdrawAttribution(claimId: string, reason: string): Promise<void> {
  const ctx = await requireApprover()
  const note = reason.trim()
  if (!note) throw new UserFacingError('Say why the credit is being withdrawn.')
  const { error } = await ctx.supabase.rpc('withdraw_partner_attribution', {
    p_claim_id: claimId, p_reason: note,
  })
  if (error) throw dbFailure('save that', error)
  revalidateSgp()
}

/** Founder/admin only — it decides who holds the second signature. */
export async function setSgpApprover(targetUserId: string, isApprover: boolean): Promise<void> {
  const { supabase } = await requireRole(['founder', 'admin'])
  const { error } = await supabase
    .from('users')
    .update({ is_sgp_approver: isApprover })
    .eq('id', targetUserId)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/admin/users')
  revalidatePath('/sgp-desk')
}
