'use server'

import { requireRole } from '@/lib/guards'
import { createClient } from '@/lib/supabase/server'
import type { InvestorContact } from '@/lib/types'

type ContactDraft = {
  name: string
  role: string | null
  linkedin_url: string | null
  linkedin_status: string | null
  phone: string | null
  email: string | null
  sort_order: number
}

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}

// ── Investors ─────────────────────────────────────────────────────────────────

export async function createInvestor(params: {
  name: string
  country: string | null
  website: string | null
  sectors: string[]
  service_type: string
  esv_poc_id: string | null
  esv_poc_ids?: string[]
  ticket_size_min: number | null
  ticket_size_max: number | null
  stage: string | null
  referred_by_partner_id: string | null
  contacts: ContactDraft[]
  isPartnerReferral?: boolean
}): Promise<{ id: string }> {
  const { isPartnerReferral, contacts, ...fields } = params

  let supabase: Awaited<ReturnType<typeof requireRole>>['supabase']
  let userId: string
  let orgId: string | null
  let referredByPartnerId = fields.referred_by_partner_id

  if (isPartnerReferral) {
    const result = await requireRole(['franchise_partner'])
    supabase = result.supabase
    userId = result.userId
    orgId = result.orgId
    // Auto-resolve the partner's own franchise_partner_id
    const { data: userRow } = await supabase
      .from('users')
      .select('franchise_partner_id')
      .eq('id', userId)
      .single()
    referredByPartnerId = userRow?.franchise_partner_id ?? null
  } else {
    const result = await requireInternal()
    supabase = result.supabase
    userId = result.userId
    orgId = result.orgId
  }

  const { data: investor, error } = await supabase
    .from('investors')
    .insert({
      name: fields.name,
      country: fields.country || null,
      website: fields.website || null,
      sectors: fields.sectors,
      service_type: fields.service_type,
      esv_poc_id: fields.esv_poc_id || null,
      ticket_size_min: fields.ticket_size_min,
      ticket_size_max: fields.ticket_size_max,
      stage: fields.stage || null,
      referred_by_partner_id: referredByPartnerId,
      created_by: userId,
      org_id: orgId,
    })
    .select('id')
    .single()

  if (error) throw error

  const pocIds = fields.esv_poc_ids && fields.esv_poc_ids.length > 0
    ? fields.esv_poc_ids
    : fields.esv_poc_id ? [fields.esv_poc_id] : []
  if (pocIds.length > 0) {
    await supabase.from('investor_poc_users').insert(
      pocIds.map((uid) => ({ investor_id: investor.id, user_id: uid }))
    )
  }

  if (contacts.length > 0 && fields.service_type !== 'angel_investor') {
    const { error: contactErr } = await supabase.from('investor_contacts').insert(
      contacts.map((c, i) => ({
        investor_id: investor.id,
        name: c.name,
        role: c.role || null,
        linkedin_url: c.linkedin_url || null,
        linkedin_status: c.linkedin_status || null,
        phone: c.phone || null,
        email: c.email || null,
        sort_order: c.sort_order ?? i,
      }))
    )
    if (contactErr) throw contactErr
  }

  return { id: investor.id }
}

export async function updateInvestor(
  id: string,
  params: {
    name: string
    country: string | null
    website: string | null
    sectors: string[]
    service_type: string
    esv_poc_id: string | null
    esv_poc_ids?: string[]
    ticket_size_min: number | null
    ticket_size_max: number | null
    stage: string | null
    referred_by_partner_id: string | null
  }
): Promise<void> {
  // Partners may edit their own referrals, but never the ESV POC or referral attribution.
  const { supabase, role } = await requireRole(['founder', 'admin', 'franchise_partner'])
  const isPartner = role === 'franchise_partner'

  const baseFields = {
    name: params.name,
    country: params.country || null,
    website: params.website || null,
    sectors: params.sectors,
    service_type: params.service_type,
    ticket_size_min: params.ticket_size_min,
    ticket_size_max: params.ticket_size_max,
    stage: params.stage || null,
  }

  const { error } = await supabase
    .from('investors')
    .update(
      isPartner
        ? baseFields
        : { ...baseFields, referred_by_partner_id: params.referred_by_partner_id || null }
    )
    .eq('id', id)
  if (error) throw error

  // POC mapping is admin-owned — partners never touch investor_poc_users.
  if (!isPartner) {
    const pocIds = params.esv_poc_ids ?? (params.esv_poc_id ? [params.esv_poc_id] : [])
    await supabase.from('investor_poc_users').delete().eq('investor_id', id)
    if (pocIds.length > 0) {
      await supabase.from('investor_poc_users').insert(
        pocIds.map((uid) => ({ investor_id: id, user_id: uid }))
      )
    }
  }
}

export async function deleteInvestor(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('investors').delete().eq('id', id)
  if (error) throw error
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function addContact(
  investorId: string,
  params: ContactDraft
): Promise<InvestorContact> {
  // Allow franchise_partner too — RLS enforces they can only add to their own referrals
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'franchise_partner'])
  const { data, error } = await supabase
    .from('investor_contacts')
    .insert({
      investor_id: investorId,
      name: params.name,
      role: params.role || null,
      linkedin_url: params.linkedin_url || null,
      linkedin_status: params.linkedin_status || null,
      phone: params.phone || null,
      email: params.email || null,
      sort_order: params.sort_order,
    })
    .select()
    .single()
  if (error) throw error
  return data as InvestorContact
}

export async function updateContact(
  contactId: string,
  params: ContactDraft
): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase
    .from('investor_contacts')
    .update({
      name: params.name,
      role: params.role || null,
      linkedin_url: params.linkedin_url || null,
      linkedin_status: params.linkedin_status || null,
      phone: params.phone || null,
      email: params.email || null,
    })
    .eq('id', contactId)
  if (error) throw error
}

export async function deleteContact(contactId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('investor_contacts').delete().eq('id', contactId)
  if (error) throw error
}
