import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/user'

/* The associate referral form and pipeline — same shape as lib/partner-companies.ts, kept separate
   rather than generalising the two together. Partner attribution is keyed off franchise_partner_id;
   this is keyed off the user id directly, and the two read/write paths diverge enough (a partner's
   whole page has claims and referred-company sections that don't apply here) that forcing one set
   of functions to serve both would mean branching throughout. See 20261007000000 for the schema. */

export type AssociateReferralForm = {
  id: string
  title: string
  published: boolean
  pipelineId: string
  myToken: string | null
}

/** The org's associate-referral form, the associate-intake pipeline it feeds, and this user's own link. */
export const fetchAssociateReferralForm = cache(async (): Promise<AssociateReferralForm | null> => {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return null

  const { data: form, error } = await supabase
    .from('forms')
    .select('id, title, published, pipeline_id, links:form_links(token, created_by)')
    .eq('is_associate_form', true)
    .maybeSingle()
  if (error) {
    console.error('[associate-referrals] form read failed:', error.message)
    return null
  }
  if (!form) return null

  const links = (form.links ?? []) as Array<{ token: string; created_by: string }>
  return {
    id: form.id,
    title: form.title,
    published: form.published,
    pipelineId: form.pipeline_id,
    myToken: links.find((l) => l.created_by === user.id)?.token ?? null,
  }
})

export type SourcedEntry = {
  id: string
  title: string | null
  submitted_at: string
  submitter_name: string | null
  submitter_email: string | null
  stage: { name: string; stage_type: string; color: string | null } | null
  rejection_reason: string | null
}

/** What this user has sourced on the associate-intake pipeline — their own submissions and
    anything that came in through their link, whoever it's currently assigned to. */
export const fetchMySourcedEntries = cache(async (): Promise<SourcedEntry[]> => {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitted_at, submitter_name, submitter_email, rejection_reason, stage:pipeline_stages!stage_id(name, stage_type, color)')
    .eq('sourced_by_associate_id', user.id)
    .order('submitted_at', { ascending: false })
  if (error) {
    console.error('[associate-referrals] sourced-entries read failed:', error.message)
    return []
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    stage: Array.isArray(r.stage) ? r.stage[0] ?? null : r.stage ?? null,
  }))
})
