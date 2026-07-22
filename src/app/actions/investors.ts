'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/guards'
import { createClient } from '@/lib/supabase/server'
import { parseInvestorsCsv } from '@/lib/investors-csv'
import type { InvestorContact, InvestorPortfolioItem } from '@/lib/types'

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

// Auto-generated at creation, future-proofing for possible investor login/portal access
// later. Not user-editable, so a plain slug-plus-suffix scheme is enough.
function slugifyUsername(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'investor'
}

async function generateUniqueUsername(supabase: SupabaseClient, name: string): Promise<string> {
  const base = slugifyUsername(name)
  let candidate = base
  let suffix = 0
  for (;;) {
    const { data } = await supabase.from('investors').select('id').eq('username', candidate).maybeSingle()
    if (!data) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export async function createInvestor(params: {
  name: string
  country: string | null
  website: string | null
  sectors: string[]
  business_types?: string[]
  meta_tags?: string[]
  service_type: string
  esv_poc_id: string | null
  esv_poc_ids?: string[]
  ticket_size_min: number | null
  ticket_size_max: number | null
  stage: string | null
  referred_by_partner_id: string | null
  onboarding_form_completed?: boolean
  onboarding_form_url?: string | null
  kyc_done?: boolean
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

  const username = await generateUniqueUsername(supabase, fields.name)

  const { data: investor, error } = await supabase
    .from('investors')
    .insert({
      name: fields.name,
      username,
      country: fields.country || null,
      website: fields.website || null,
      sectors: fields.sectors,
      business_types: fields.business_types ?? [],
      meta_tags: fields.meta_tags ?? [],
      service_type: fields.service_type,
      esv_poc_id: fields.esv_poc_id || null,
      ticket_size_min: fields.ticket_size_min,
      ticket_size_max: fields.ticket_size_max,
      stage: fields.stage || null,
      referred_by_partner_id: referredByPartnerId,
      onboarding_form_completed: fields.onboarding_form_completed ?? false,
      onboarding_form_url: fields.onboarding_form_url || null,
      kyc_done: fields.kyc_done ?? false,
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

const LOGGED_FIELD_LABELS: Record<string, string> = {
  name: 'Name', country: 'Country', website: 'Website', sectors: 'Sectors',
  business_types: 'Business types', meta_tags: 'Meta-tags', service_type: 'Type',
  ticket_size_min: 'Ticket min', ticket_size_max: 'Ticket max', stage: 'Stage',
  referred_by_partner_id: 'Referred by partner', onboarding_form_completed: 'Onboarding completed',
  onboarding_form_url: 'Onboarding form URL', kyc_done: 'KYC done',
}

function displayValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : '—'
  return String(v)
}

function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, label] of Object.entries(LOGGED_FIELD_LABELS)) {
    const a = JSON.stringify(before[key] ?? null)
    const b = JSON.stringify(after[key] ?? null)
    if (a !== b) lines.push(`${label}: ${displayValue(before[key])} → ${displayValue(after[key])}`)
  }
  return lines.join('; ')
}

export async function updateInvestor(
  id: string,
  params: {
    name: string
    country: string | null
    website: string | null
    sectors: string[]
    business_types?: string[]
    meta_tags?: string[]
    service_type: string
    esv_poc_id: string | null
    esv_poc_ids?: string[]
    ticket_size_min: number | null
    ticket_size_max: number | null
    stage: string | null
    referred_by_partner_id: string | null
    onboarding_form_completed?: boolean
    onboarding_form_url?: string | null
    kyc_done?: boolean
  }
): Promise<void> {
  // Partners may edit their own referrals, but never the ESV POC or referral attribution.
  const { supabase, role, userId, orgId } = await requireRole(['founder', 'admin', 'associate', 'franchise_partner'])
  const isPartner = role === 'franchise_partner'

  const baseFields = {
    name: params.name,
    country: params.country || null,
    website: params.website || null,
    sectors: params.sectors,
    business_types: params.business_types ?? [],
    meta_tags: params.meta_tags ?? [],
    service_type: params.service_type,
    ticket_size_min: params.ticket_size_min,
    ticket_size_max: params.ticket_size_max,
    stage: params.stage || null,
    onboarding_form_completed: params.onboarding_form_completed ?? false,
    onboarding_form_url: params.onboarding_form_url || null,
    kyc_done: params.kyc_done ?? false,
  }
  const nextFields = isPartner ? baseFields : { ...baseFields, referred_by_partner_id: params.referred_by_partner_id || null }

  const { data: before } = await supabase
    .from('investors')
    .select(Object.keys(LOGGED_FIELD_LABELS).join(', '))
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('investors')
    .update(nextFields)
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

  // Best-effort audit log — never fail the save if logging hiccups.
  try {
    const changes = before ? describeChanges(before as unknown as Record<string, unknown>, nextFields) : ''
    if (changes) {
      const { data: editor } = await supabase.from('users').select('name').eq('id', userId).single()
      await supabase.from('investor_edit_log').insert({
        investor_id: id,
        org_id: orgId,
        edited_by: userId,
        edited_by_name: editor?.name ?? null,
        investor_name: params.name,
        changes,
      })
    }
  } catch { /* non-fatal: don't block the save if the audit log insert fails */ }
}

export async function deleteInvestor(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('investors').delete().eq('id', id)
  if (error) throw error
}

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

// Every deal this investor is attached to, with the linked company's tags — the "Investment
// History" panel. Doubles as inferred preferences: sectors/meta_tags the investor has actually
// backed, distinct from (and shown alongside) their self-declared sectors/business_types.
export async function getInvestorPortfolio(investorId: string): Promise<InvestorPortfolioItem[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'franchise_partner'])
  const { data } = await supabase
    .from('active_deal_investors')
    .select(`
      active_deal_id,
      investment_amount,
      active_deal:active_deals(
        deal_state,
        entry:pipeline_entries(title, company:companies(id, name, sectors, meta_tags))
      )
    `)
    .eq('investor_id', investorId)

  return ((data ?? []) as unknown as Array<{
    active_deal_id: string
    investment_amount: number | null
    active_deal: unknown
  }>).map((row) => {
    const deal = one(row.active_deal) as { deal_state: string; entry: unknown } | null
    const entry = one(deal?.entry) as { title: string | null; company: unknown } | null
    const company = one(entry?.company) as { id: string; name: string; sectors: string[]; meta_tags: string[] } | null
    return {
      active_deal_id: row.active_deal_id,
      deal_title: entry?.title ?? null,
      deal_state: (deal?.deal_state ?? 'active') as InvestorPortfolioItem['deal_state'],
      investment_amount: row.investment_amount,
      company_id: company?.id ?? null,
      company_name: company?.name ?? null,
      company_sectors: company?.sectors ?? [],
      company_meta_tags: company?.meta_tags ?? [],
    }
  })
}

// ── CSV import ────────────────────────────────────────────────────────────────

export type InvestorImportResult = { created: number; updated: number; errors: { row: number; message: string }[] }

/**
 * Bulk-import investors from an investor-shaped CSV. Deduped by name (case-insensitive,
 * within the org): a matching profile is UPDATED in place, filling only blank scalar fields
 * and unioning tag lists (sectors/business_types/meta_tags) — never clobbering existing data.
 * A new name creates a fresh profile (service_type defaults to vc_fund if left blank).
 */
export async function importInvestorsCsv(csvText: string): Promise<InvestorImportResult> {
  const { supabase, userId, orgId } = await requireInternal()
  if (!orgId) throw new Error('No organisation in scope.')

  const { rows, errors } = parseInvestorsCsv(csvText)
  if (rows.length === 0) return { created: 0, updated: 0, errors }

  let created = 0
  let updated = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const { data: existing } = await supabase
        .from('investors')
        .select('id, country, website, stage, sectors, business_types, meta_tags, ticket_size_min, ticket_size_max')
        .eq('org_id', orgId)
        .ilike('name', row.name)
        .maybeSingle()

      if (existing) {
        const patch: Record<string, unknown> = {}
        if (!existing.country && row.country) patch.country = row.country
        if (!existing.website && row.website) patch.website = row.website
        if (!existing.stage && row.stage) patch.stage = row.stage
        if (existing.ticket_size_min == null && row.ticket_size_min != null) patch.ticket_size_min = row.ticket_size_min
        if (existing.ticket_size_max == null && row.ticket_size_max != null) patch.ticket_size_max = row.ticket_size_max
        const mergedSectors = Array.from(new Set([...(existing.sectors ?? []), ...row.sectors]))
        if (mergedSectors.length > (existing.sectors?.length ?? 0)) patch.sectors = mergedSectors
        const mergedBusinessTypes = Array.from(new Set([...(existing.business_types ?? []), ...row.business_types]))
        if (mergedBusinessTypes.length > (existing.business_types?.length ?? 0)) patch.business_types = mergedBusinessTypes
        const mergedMetaTags = Array.from(new Set([...(existing.meta_tags ?? []), ...row.meta_tags]))
        if (mergedMetaTags.length > (existing.meta_tags?.length ?? 0)) patch.meta_tags = mergedMetaTags
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from('investors').update(patch).eq('id', existing.id)
          if (error) throw error
        }
        updated++
      } else {
        const username = await generateUniqueUsername(supabase, row.name)
        const { error } = await supabase.from('investors').insert({
          org_id: orgId,
          created_by: userId,
          name: row.name,
          username,
          service_type: row.service_type ?? 'vc_fund',
          country: row.country,
          website: row.website,
          stage: row.stage,
          sectors: row.sectors,
          business_types: row.business_types,
          meta_tags: row.meta_tags,
          ticket_size_min: row.ticket_size_min,
          ticket_size_max: row.ticket_size_max,
        })
        if (error) throw error
        created++
      }
    } catch (e) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Failed to import row.' })
    }
  }

  return { created, updated, errors }
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
