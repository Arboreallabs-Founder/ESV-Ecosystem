import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PartnerCompany, UserRow } from './types'

/* Partner-sourced company submissions and the coordinator queue.

   RLS does the scoping: a partner's query returns only their own submissions, an assignee's
   returns only what was handed to them, and coordinators and leadership see the whole queue. The
   same function serves all three. */

const SELECT = `
  *,
  submitter:submitted_by(name, photo_url),
  partner:franchise_partners!partner_id(name),
  assignee:assigned_to(name, photo_url),
  coordinator:coordinator_id(name)
`

export const fetchPartnerCompanies = cache(async (): Promise<PartnerCompany[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partner_companies')
    .select(SELECT)
    .order('created_at', { ascending: false })

  // Surfaced rather than swallowed: an empty queue and a failed read look identical otherwise,
  // and a coordinator seeing "nothing to triage" when there is would be a silent failure.
  if (error) {
    console.error('[partner-companies] read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as PartnerCompany[]
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
  const { data, error } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitted_at, partner_notes, submitter_name, submitter_email, rejection_reason, stage:pipeline_stages!stage_id(name, stage_type, color)')
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
