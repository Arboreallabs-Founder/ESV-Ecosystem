'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { InvestmentStage, PocEmployment, PocRank } from '@/lib/types'

/**
 * Investor profile: portfolio entries and the POC employment audit.
 *
 * The audit is the part that earns its keep. A fund's preferences change slowly; who works there
 * changes constantly, and a contact list nobody has verified is worse than none — it sends people
 * to email addresses that bounce.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'hr'])
}

function revalidate(investorId: string) {
  revalidatePath(`/investors/${investorId}`)
  revalidatePath('/investors')
}

// ── Portfolio ────────────────────────────────────────────────────────────────

export async function addPortfolioEntry(investorId: string, input: {
  company_name: string
  sector_tags?: string[]
  business_type_tags?: string[]
  invested_stage?: InvestmentStage | null
  invested_year?: number | null
  notes?: string | null
}): Promise<void> {
  const { supabase, orgId, userId } = await requireInternal()
  const name = input.company_name.trim()
  if (!name) throw new Error('A company name is required.')

  // Link to a company we already track when the name matches, so the profile can say "we already
  // have a record on 3 of their portfolio companies". Unmatched names are kept as text — most of
  // these companies are not ours and never will be.
  const { data: match } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  const { error } = await supabase.from('investor_portfolio').insert({
    org_id: orgId,
    investor_id: investorId,
    company_name: name,
    company_id: match?.id ?? null,
    sector_tags: input.sector_tags ?? [],
    business_type_tags: input.business_type_tags ?? [],
    invested_stage: input.invested_stage ?? null,
    invested_year: input.invested_year ?? null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  })
  if (error) {
    if ((error as any).code === '23505') throw new Error(`${name} is already on this portfolio.`)
    throw error
  }
  revalidate(investorId)
}

export async function updatePortfolioEntry(entryId: string, input: {
  sector_tags?: string[]
  business_type_tags?: string[]
  invested_stage?: InvestmentStage | null
  invested_year?: number | null
  notes?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_portfolio')
    .update({
      sector_tags: input.sector_tags,
      business_type_tags: input.business_type_tags,
      invested_stage: input.invested_stage ?? null,
      invested_year: input.invested_year ?? null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', entryId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

export async function deletePortfolioEntry(entryId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_portfolio').delete().eq('id', entryId).select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

// ── POC audit ────────────────────────────────────────────────────────────────

/**
 * Record the outcome of checking whether a POC still works there.
 *
 * Stamps last_verified_at, because "active" with no date is a claim with no evidence — and the
 * whole point of the audit is knowing how stale the answer is.
 */
export async function setContactEmployment(contactId: string, input: {
  employment_status: PocEmployment
  new_company?: string | null
  new_designation?: string | null
  audit_note?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_contacts')
    .update({
      employment_status: input.employment_status,
      // Where they went only makes sense for someone who left; clearing it avoids a stale
      // "now at X" sitting under a contact who never moved.
      new_company: input.employment_status === 'moved_on' ? (input.new_company?.trim() || null) : null,
      new_designation: input.employment_status === 'moved_on' ? (input.new_designation?.trim() || null) : null,
      audit_note: input.audit_note?.trim() || null,
      last_verified_at: input.employment_status === 'unknown' ? null : new Date().toISOString(),
    })
    .eq('id', contactId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

/**
 * Promote a contact to primary or secondary.
 *
 * A partial unique index allows only one primary per investor, so promoting one must demote the
 * incumbent first — otherwise the write fails with a constraint error the user cannot act on.
 */
export async function setContactRank(contactId: string, rank: PocRank): Promise<void> {
  const { supabase } = await requireInternal()

  const { data: contact, error: cErr } = await supabase
    .from('investor_contacts').select('investor_id').eq('id', contactId).single()
  if (cErr) throw cErr

  if (rank === 'primary') {
    await supabase
      .from('investor_contacts')
      .update({ rank: 'other' })
      .eq('investor_id', contact.investor_id)
      .eq('rank', 'primary')
      .neq('id', contactId)
  }

  const { error } = await supabase.from('investor_contacts').update({ rank }).eq('id', contactId)
  if (error) throw error
  revalidate(contact.investor_id as string)
}

/** Who from our team spoke to them, and how. */
export async function setContactOutreach(contactId: string, input: {
  contacted_by_user_id?: string | null
  contacted_by_name?: string | null
  contact_method?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_contacts')
    .update({
      contacted_by_user_id: input.contacted_by_user_id || null,
      contacted_by_name: input.contacted_by_name?.trim() || null,
      contact_method: input.contact_method?.trim() || null,
    })
    .eq('id', contactId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}
