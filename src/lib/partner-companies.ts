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
