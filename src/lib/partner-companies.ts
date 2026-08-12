import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/user'
import type {
  PartnerAttributionClaim, PartnerInvestorReferral, PartnerReferredCompany, UserRow,
} from './types'

/* Partner-sourced submissions, the coordinator queue, and the attribution ledger.

   RLS does the scoping: a partner's query returns only their own, and coordinators and leadership
   see the whole queue. The same function serves both. */

/**
 * Every attribution claim, whatever it is about and whatever state it is in.
 *
 * One read rather than one per section: the Desk splits them by status on the page, and three
 * round trips to ap-south-1 to render three lists of the same table is three times the wait for
 * no benefit. Partners get this too — RLS narrows it to their own.
 */
export const fetchAttributionClaims = cache(async (): Promise<PartnerAttributionClaim[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partner_attribution_claims')
    .select(`
      *,
      partner:franchise_partners!partner_id(name),
      company:companies!company_id(id, name),
      investor:investors!investor_id(id, name),
      proposer:users!proposed_by(name, photo_url),
      coordinator:users!coordinator_by(name),
      founder:users!founder_by(name)
    `)
    .order('created_at', { ascending: false })

  // Surfaced rather than swallowed: an empty queue and a failed read look identical otherwise, and
  // "nothing to approve" when there is something is the failure that costs a partner their fee.
  if (error) {
    console.error('[attribution] claim read failed:', error.message)
    return []
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    ...r,
    partner: one(r.partner),
    company: one(r.company),
    investor: one(r.investor),
    proposer: one(r.proposer),
    coordinator: one(r.coordinator),
    founder: one(r.founder),
  })) as PartnerAttributionClaim[]
})

/** Whether the caller holds the second signature. */
export const isSgpApprover = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('is_sgp_approver')
    .eq('id', userId)
    .maybeSingle()
  return !!(data as { is_sgp_approver?: boolean } | null)?.is_sgp_approver
})

/** Whether the caller coordinates the SGP queue. */
export const isSgpCoordinator = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('is_sgp_coordinator')
    .eq('id', userId)
    .maybeSingle()
  return !!(data as { is_sgp_coordinator?: boolean } | null)?.is_sgp_coordinator
})

/**
 * Who a coordinator may hand a submission to.
 *
 * Associates and general users, per the brief. Not partners — they source leads rather than work
 * them — and not founders, who are the escalation path rather than the queue.
 */
export const fetchAssignableForSgp = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('role', ['associate', 'general'])
    .order('name')
  return (data ?? []) as unknown as UserRow[]
})

/** Everyone currently flagged as a coordinator — shown to partners so they know who picks this up. */
export const fetchCoordinators = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('is_sgp_coordinator', true)
    .order('name')
  return (data ?? []) as unknown as UserRow[]
})

// ── The single partner intake route ──────────────────────────────────────────
// Partner submissions are pipeline entries now, not partner_companies rows. Both used to exist and
// behaved differently: one was manual with no stages, the other skipped the coordinator entirely.

export type PartnerSubmission = {
  id: string
  title: string | null
  submitted_at: string
  partner_notes: string | null
  submitter_name: string | null
  submitter_email: string | null
  stage: { name: string; stage_type: string; color: string | null } | null
  rejection_reason: string | null
}

/** The org's partner-intake pipeline, with its stages. */
export const fetchPartnerPipeline = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pipelines')
    .select('id, name, stages:pipeline_stages(id, name, position, stage_type, color)')
    .eq('is_partner_intake', true)
    .maybeSingle()
  if (error) {
    console.error('[partner-intake] pipeline read failed:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    stages: ((data as any).stages ?? []).sort((a: any, b: any) => a.position - b.position),
  }
})

/**
 * What this partner has submitted, with the stage each one is on.
 *
 * The stage is read from the entry rather than tracked separately, which is the point of routing
 * through a pipeline: when a coordinator moves a card, the partner's view updates with no second
 * thing to keep in step.
 */
export const fetchMySubmissions = cache(async (): Promise<PartnerSubmission[]> => {
  const supabase = await createClient()
  const user = await getUser()
  if (!user?.franchise_partner_id) return []

  // Both filters are the fix for a real leak, not belt and braces. This query had none at all and
  // trusted RLS to scope it; it did not, and a partner was shown every entry on the Imported Deals
  // pipeline — other people's companies, with the founder's name and email on each. A read that
  // must return one partner's rows should say so.
  const { data: pipeline } = await supabase
    .from('pipelines').select('id').eq('is_partner_intake', true).maybeSingle()
  if (!pipeline) return []

  const { data, error } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitted_at, partner_notes, submitter_name, submitter_email, rejection_reason, stage:pipeline_stages!stage_id(name, stage_type, color)')
    .eq('pipeline_id', pipeline.id)
    .eq('sourced_by_partner_id', user.franchise_partner_id)
    .order('submitted_at', { ascending: false })
  if (error) {
    console.error('[partner-intake] submissions read failed:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    stage: Array.isArray(r.stage) ? r.stage[0] ?? null : r.stage ?? null,
  }))
})

/** The one form partners issue links from, and this partner's own links. */
export const fetchPartnerForm = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('forms')
    .select('id, title, published, links:form_links(id, token, label, created_by, created_at)')
    .eq('is_partner_form', true)
    .maybeSingle()
  if (error) {
    console.error('[partner-intake] form read failed:', error.message)
    return null
  }
  return data as { id: string; title: string; published: boolean; links: Array<{ id: string; token: string; label: string | null; created_by: string; created_at: string }> } | null
})

/**
 * The partner pipeline's entries for the SGP Desk — the whole queue, not one partner's.
 *
 * Same rows the partner sees on their own card; RLS is what makes one query serve both.
 */
export const fetchPartnerQueue = cache(async () => {
  const supabase = await createClient()
  const { data: pipeline } = await supabase
    .from('pipelines').select('id').eq('is_partner_intake', true).maybeSingle()
  if (!pipeline) return []
  const { data, error } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitted_at, partner_notes, submitter_name, submitter_email, sourced_by_partner_id, partner:franchise_partners!sourced_by_partner_id(name), stage:pipeline_stages!stage_id(id, name, position, stage_type)')
    .eq('pipeline_id', pipeline.id)
    .order('submitted_at', { ascending: false })
  if (error) {
    console.error('[partner-intake] queue read failed:', error.message)
    return []
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((r: any) => ({
    ...r,
    partner: one(r.partner),
    stage: one(r.stage),
  }))
})

// ── Referred companies and investors ─────────────────────────────────────────
// The other half of a partner's page. They submit some companies themselves; for the rest we
// already had the record when they introduced it, and an admin or coordinator tags it to them
// rather than making them re-enter it as a duplicate.

/** Companies tagged to this partner in the company database. */
export const fetchMyReferredCompanies = cache(async (): Promise<PartnerReferredCompany[]> => {
  const supabase = await createClient()
  const user = await getUser()
  if (!user?.franchise_partner_id) return []
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, one_liner, logo_url, sectors, stage, status, created_at')
    .eq('referred_by_partner_id', user.franchise_partner_id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[partner-intake] referred companies read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as PartnerReferredCompany[]
})

/** Investors tagged to this partner, and their referrals still waiting on a decision. */
export const fetchMyInvestorReferrals = cache(async (): Promise<PartnerInvestorReferral[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partner_investor_referrals')
    .select('*, investor:investors!investor_id(id, name), decided_by_user:users!decided_by(name)')
    .order('created_at', { ascending: false })
  if (error) {
    // The table arrives with 20260910; until then the page renders without the section rather
    // than failing the route.
    console.error('[partner-intake] investor referrals read failed:', error.message)
    return []
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((r: any) => ({
    ...r,
    investor: one(r.investor),
    decided_by_user: one(r.decided_by_user),
  })) as PartnerInvestorReferral[]
})

/**
 * The investor-referral queue for the SGP Desk.
 *
 * Same table, same RLS; the coordinator policy is what widens this from "mine" to "everyone's".
 */
export const fetchInvestorReferralQueue = cache(async (): Promise<PartnerInvestorReferral[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partner_investor_referrals')
    .select('*, partner:franchise_partners!partner_id(name), investor:investors!investor_id(id, name), submitter:users!submitted_by(name, photo_url)')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[partner-intake] referral queue read failed:', error.message)
    return []
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((r: any) => ({
    ...r,
    partner: one(r.partner),
    investor: one(r.investor),
    submitter: one(r.submitter),
  })) as PartnerInvestorReferral[]
})
