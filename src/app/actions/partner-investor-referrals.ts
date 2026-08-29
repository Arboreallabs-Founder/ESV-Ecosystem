'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { requireRole } from '@/lib/guards'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { ServiceType } from '@/lib/types'
import { proposeAttribution } from './partner-attribution'

/* Investor referrals from partners, and the coordinator's decision.
 *
 * Partners cannot create investors (20260905): adding a fund we already hold makes a duplicate
 * record and a second claim on one relationship. But "tell us and we will tag it" was a WhatsApp
 * message with nothing tracking it, so referrals were lost and partners stopped bothering. This is
 * that conversation with a queue and an outcome.
 *
 * RLS enforces all of it independently; these guards exist so a refusal arrives as a readable
 * message rather than a silent zero-row write.
 */

async function requireCoordinator() {
  const ctx = await requireRole(['founder', 'admin', 'associate', 'general'])
  const { data } = await ctx.supabase
    .from('users')
    .select('is_sgp_coordinator')
    .eq('id', ctx.userId)
    .maybeSingle()

  const isCoordinator = !!(data as { is_sgp_coordinator?: boolean } | null)?.is_sgp_coordinator
  if (!isCoordinator && !['founder', 'admin'].includes(ctx.role)) {
    throw new UserFacingError('Only an SGP Coordinator can decide investor referrals.')
  }
  return ctx
}

export type InvestorReferralInput = {
  name: string
  /** What the partner says this is. Optional: a name with no type is still worth having. */
  service_type?: ServiceType | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  website?: string | null
  notes?: string | null
}

/** A partner refers an investor. Only the name is required — a form that demands more loses it. */
export async function submitInvestorReferral(input: InvestorReferralInput) {
  const ctx = await requireRole(['franchise_partner'])

  const name = input.name.trim()
  if (!name) throw new UserFacingError('Give the investor a name.')

  const { data: me } = await ctx.supabase
    .from('users')
    .select('franchise_partner_id, org_id')
    .eq('id', ctx.userId)
    .maybeSingle()

  const partnerId = (me as { franchise_partner_id?: string | null } | null)?.franchise_partner_id
  if (!partnerId) {
    throw new UserFacingError('Your account is not linked to a partner record yet. Ask Earlyseed Ventures to set that up.')
  }

  // Recorded as given, checked on accept. A referral is a claim from outside; refusing the whole
  // submission over a type we do not recognise would lose the introduction to save a dropdown.
  const type = input.service_type && Object.prototype.hasOwnProperty.call(SERVICE_TYPE_LABELS, input.service_type)
    ? input.service_type
    : null

  const { error } = await ctx.supabase.from('partner_investor_referrals').insert({
    org_id: (me as { org_id?: string | null } | null)?.org_id,
    partner_id: partnerId,
    submitted_by: ctx.userId,
    name,
    service_type: type,
    contact_name: input.contact_name?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    website: input.website?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) throw dbFailure('save that', error)
}

/**
 * Possible matches for a referral, so a coordinator can see whether we already hold the fund.
 *
 * This is the check the whole flow exists for. Substring alone misses "Elixiir" against "Elixir",
 * so the search is loosened to the first significant word as well — a few false matches shown to
 * someone who is deciding anyway cost nothing; a missed one creates the duplicate.
 */
export async function findInvestorMatches(name: string) {
  const ctx = await requireCoordinator()
  const term = name.trim()
  if (!term) return []

  const firstWord = term.split(/\s+/).filter((w) => w.length > 3)[0] ?? term
  const { data } = await ctx.supabase
    .from('investors')
    .select('id, name, service_type, country, website, referred_by_partner_id')
    .or(`name.ilike.%${term}%,name.ilike.%${firstWord}%`)
    .limit(8)
  return (data ?? []) as Array<{
    id: string
    name: string
    service_type: string | null
    country: string | null
    website: string | null
    referred_by_partner_id: string | null
  }>
}

/**
 * Accept a referral against a fund we already hold.
 *
 * Points the referral at the existing investor rather than creating a second record — and files an
 * attribution claim instead of tagging it. Accepting is the coordinator saying "yes, this is a real
 * introduction"; it is not the founder agreeing to pay for it, and those used to be the same
 * keystroke.
 */
export async function acceptReferralOntoExisting(referralId: string, investorId: string) {
  const ctx = await requireCoordinator()

  const { data: investor } = await ctx.supabase
    .from('investors')
    .select('id, name, referred_by_partner_id')
    .eq('id', investorId)
    .maybeSingle()
  if (!investor) throw new UserFacingError('That investor no longer exists.')

  const { data: referral } = await ctx.supabase
    .from('partner_investor_referrals')
    .select('partner_id, status')
    .eq('id', referralId)
    .maybeSingle()
  if (!referral) throw new UserFacingError('That referral no longer exists.')
  if ((referral as { status: string }).status !== 'pending') {
    throw new UserFacingError('This referral has already been decided.')
  }

  const existingPartner = (investor as { referred_by_partner_id: string | null }).referred_by_partner_id
  const claimingPartner = (referral as { partner_id: string }).partner_id
  if (existingPartner && existingPartner !== claimingPartner) {
    throw new UserFacingError(
      `${(investor as { name: string }).name} is already credited to another partner. `
      + 'Two partners claiming one relationship is a fee question — settle it before tagging.',
    )
  }

  await decide(ctx, referralId, 'accepted', investorId, null)
  await proposeAttribution({
    investorId,
    partnerId: claimingPartner,
    source: 'investor_referral',
    referralId,
  })
}

/**
 * Accept a referral for a fund we do not hold: create it, then claim it.
 *
 * The fund is created untagged. A record cannot be born carrying an attribution any more — the
 * database refuses it — because that was the neatest way to acquire a credited partner without
 * anyone approving anything.
 *
 * ─── Why the type is a parameter and not a default ─────────────────────────
 * investors.service_type is NOT NULL and this insert never set it, so accepting a referral as a new
 * fund has failed since the day it shipped — 23502, with the message stripped in production, which
 * is why it read as nothing having happened.
 *
 * Defaulting it to vc_fund would have been the quick fix and a bad one. Investor lists exclude
 * angel_investor in the database precisely so a founder's raise plans never reach an angel who
 * knows them personally. An angel filed as a VC fund by a default nobody chose would defeat that,
 * and would do it silently. A partner referring somebody knows what they are; the coordinator
 * accepting it can say so.
 */
export async function acceptReferralAsNew(referralId: string, serviceType: ServiceType) {
  const ctx = await requireCoordinator()

  const { data: referral } = await ctx.supabase
    .from('partner_investor_referrals')
    .select('*')
    .eq('id', referralId)
    .maybeSingle()
  if (!referral) throw new UserFacingError('That referral no longer exists.')
  const r = referral as {
    status: string; partner_id: string; org_id: string
    name: string; website: string | null; notes: string | null
    contact_name: string | null; contact_email: string | null; contact_phone: string | null
  }
  if (r.status !== 'pending') throw new UserFacingError('This referral has already been decided.')

  // Checked here rather than trusted from the form: this is an HTTP parameter, and the value it
  // sets decides whether the record can ever appear on a founder-facing investor list.
  if (!Object.prototype.hasOwnProperty.call(SERVICE_TYPE_LABELS, serviceType)) {
    throw new UserFacingError('Choose what kind of investor this is before adding them.')
  }

  const { data: created, error } = await ctx.supabase
    .from('investors')
    .insert({
      org_id: r.org_id,
      name: r.name,
      service_type: serviceType,
      website: r.website,
      notes: r.notes,
      created_by: ctx.userId,
    })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)

  // The person the partner named is the reason the referral is worth anything — carried over as
  // the fund's first contact rather than left behind in the referral row.
  if (r.contact_name) {
    await ctx.supabase.from('investor_contacts').insert({
      investor_id: (created as { id: string }).id,
      name: r.contact_name,
      email: r.contact_email,
      phone: r.contact_phone,
    })
  }

  await decide(ctx, referralId, 'accepted', (created as { id: string }).id, null)
  await proposeAttribution({
    investorId: (created as { id: string }).id,
    partnerId: r.partner_id,
    source: 'investor_referral',
    referralId,
  })
}

/** Turn one down. The reason is required: "no" without one is what stops partners referring. */
export async function rejectInvestorReferral(referralId: string, reason: string) {
  const ctx = await requireCoordinator()
  const note = reason.trim()
  if (!note) throw new UserFacingError('Say why, so the partner knows what to do differently.')
  await decide(ctx, referralId, 'rejected', null, note)
}

type Ctx = Awaited<ReturnType<typeof requireCoordinator>>

async function decide(
  ctx: Ctx,
  referralId: string,
  status: 'accepted' | 'rejected',
  investorId: string | null,
  note: string | null,
) {
  const { data, error } = await ctx.supabase
    .from('partner_investor_referrals')
    .update({
      status,
      investor_id: investorId,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('id', referralId)
    .eq('status', 'pending')   // two coordinators deciding at once: first one wins, loudly
    .select('id')

  if (error) throw dbFailure('save that', error)
  // An RLS-filtered update reports success having changed nothing, so the row count is the only
  // honest signal that the decision landed.
  if (!data || data.length === 0) {
    throw new UserFacingError('That referral was decided by someone else a moment ago. Reload to see the outcome.')
  }
}

/**
 * Propose that a company already in the database was introduced by a partner.
 *
 * This used to write the tag on the spot, which made it the easiest way in the whole app to credit
 * a partner with no approval at all — open the company, pick a name, done. It now files a claim
 * like every other route, and the database refuses the direct write regardless of what this
 * function does.
 *
 * Clearing is *not* the same gesture and does not go through here. Removing credit that was
 * approved is its own decision — see withdrawCompanyAttribution.
 */
export async function proposeCompanyAttribution(companyId: string, partnerId: string, note?: string | null) {
  await requireCoordinator()
  if (!partnerId) throw new UserFacingError('Choose which partner introduced this company.')
  await proposeAttribution({ companyId, partnerId, source: 'retroactive_tag', note })
}

/**
 * Clear a referral off the partner's own list.
 *
 * Pending is deleted outright: nobody has acted on it and it is their own submission sitting in a
 * queue, so nothing is lost. Decided is hidden rather than removed, because that row is the record
 * of who introduced whom and what we said back, and it is what a dispute between two partners
 * claiming one relationship would be settled against. 20260910 ruled out partner deletion for
 * exactly that reason; this keeps the half of the rule that still matters.
 *
 * The write happens inside a SECURITY DEFINER function. RLS grants rows and never columns, so a
 * partner UPDATE policy on this table would also let them set status and mark their own referral
 * accepted.
 */
export async function removeInvestorReferral(referralId: string): Promise<'deleted' | 'hidden'> {
  const ctx = await requireRole(['franchise_partner'])
  const { data, error } = await ctx.supabase.rpc('remove_investor_referral', { p_id: referralId })
  if (error) throw dbFailure('remove that referral', error)
  return (data as 'deleted' | 'hidden') ?? 'hidden'
}
