'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { findOrCreateCompanyForDeskDeal, findOrCreateCompanyByName, enumOrNull } from '@/lib/company-sync'
import { DESK_STAGES, DESK_INSTRUMENTS, DESK_ROUND_STATUSES } from '@/lib/types'
import type {
  CompanyStatus, CompanyDocType, CompanyFieldType,
  CompanyFounder, CompanyTeamMember,
} from '@/lib/types'

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate'])
}
async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// Editable fields on the master record (subset used by the section editors).
export type CompanyPatch = Partial<{
  name: string
  legal_name: string | null
  website: string | null
  logo_url: string | null
  one_liner: string | null
  description: string | null
  hq_city: string | null
  hq_country: string | null
  founded_date: string | null
  incorporation_type: string | null
  incorporation_no: string | null
  sectors: string[]
  stage: string | null
  business_model: string | null
  status: CompanyStatus
  tags: string[]
  esv_poc_id: string | null
  product_description: string | null
  usp: string | null
  tech_stack: string | null
  product_links: string[]
  arr_inr: number | null
  mrr_inr: number | null
  customers_count: number | null
  team_size: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  ask_inr: number | null
  instrument: string | null
  pre_money_inr: number | null
  post_money_inr: number | null
  round_status: string | null
  min_ticket_inr: number | null
  total_raised_inr: number | null
  use_of_funds: string | null
  founders: CompanyFounder[]
  team: CompanyTeamMember[]
}>

// ── Company CRUD ────────────────────────────────────────────────────────────

export async function createCompany(patch: CompanyPatch): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()
  const name = patch.name?.trim()
  if (!name) throw new Error('Company name is required.')
  const { data, error } = await supabase
    .from('companies')
    .insert({ ...patch, name, org_id: orgId, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  revalidatePath('/companies')
  return data.id as string
}

export async function updateCompany(id: string, patch: CompanyPatch) {
  const { supabase } = await requireInternal()
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Company name is required.')
  const { error } = await supabase.from('companies').update(patch).eq('id', id)
  if (error) throw error
  revalidatePath(`/companies/${id}`)
  revalidatePath('/companies')
}

export async function deleteCompany(id: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/companies')
}

// ── Funding rounds ──────────────────────────────────────────────────────────

export type FundingRoundInput = {
  id?: string
  round_name?: string | null
  date?: string | null
  amount_inr?: number | null
  valuation_inr?: number | null
  instrument?: string | null
  lead_investor?: string | null
  investors?: string[]
  notes?: string | null
  sort_order?: number
}

export async function saveFundingRound(companyId: string, input: FundingRoundInput) {
  const { supabase, orgId } = await requireInternal()
  const { id, ...fields } = input
  if (id) {
    const { error } = await supabase.from('company_funding_rounds').update(fields).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('company_funding_rounds').insert({ ...fields, company_id: companyId, org_id: orgId })
    if (error) throw error
  }
  revalidatePath(`/companies/${companyId}`)
}

export async function deleteFundingRound(id: string, companyId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('company_funding_rounds').delete().eq('id', id)
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

// ── Cap table ───────────────────────────────────────────────────────────────

export type CapTableInput = {
  id?: string
  holder_name: string
  holder_type?: 'founder' | 'investor' | 'esop' | 'other' | null
  pct?: number | null
  shares?: number | null
  notes?: string | null
  sort_order?: number
}

export async function saveCapTableEntry(companyId: string, input: CapTableInput) {
  const { supabase, orgId } = await requireInternal()
  const name = input.holder_name?.trim()
  if (!name) throw new Error('Holder name is required.')
  const { id, ...fields } = { ...input, holder_name: name }
  if (id) {
    const { error } = await supabase.from('company_cap_table').update(fields).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('company_cap_table').insert({ ...fields, company_id: companyId, org_id: orgId })
    if (error) throw error
  }
  revalidatePath(`/companies/${companyId}`)
}

export async function deleteCapTableEntry(id: string, companyId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('company_cap_table').delete().eq('id', id)
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function addDocument(companyId: string, label: string, docType: CompanyDocType, url: string) {
  const { supabase, userId, orgId } = await requireInternal()
  if (!label.trim() || !url.trim()) throw new Error('Label and URL are required.')
  const { error } = await supabase.from('company_documents').insert({
    company_id: companyId, org_id: orgId, label: label.trim(), doc_type: docType, url: url.trim(), created_by: userId,
  })
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

export async function removeDocument(id: string, companyId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('company_documents').delete().eq('id', id)
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

// ── Updates timeline ────────────────────────────────────────────────────────

export async function addUpdate(companyId: string, body: string) {
  const { supabase, userId, orgId } = await requireInternal()
  if (!body.trim()) throw new Error('Update text is required.')
  const { error } = await supabase.from('company_updates').insert({ company_id: companyId, org_id: orgId, body: body.trim(), author_id: userId })
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

export async function deleteUpdate(id: string, companyId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('company_updates').delete().eq('id', id)
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

// ── Custom fields ───────────────────────────────────────────────────────────

export async function saveFieldDef(input: { id?: string; label: string; field_type: CompanyFieldType; position?: number }) {
  const { supabase, orgId } = await requireAdmin()
  const label = input.label?.trim()
  if (!label) throw new Error('Field label is required.')
  if (input.id) {
    const { error } = await supabase.from('company_field_defs').update({ label, field_type: input.field_type, position: input.position ?? 0 }).eq('id', input.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('company_field_defs').insert({ label, field_type: input.field_type, position: input.position ?? 0, org_id: orgId })
    if (error) throw error
  }
  revalidatePath('/companies')
}

export async function deleteFieldDef(id: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('company_field_defs').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/companies')
}

export async function setFieldValue(companyId: string, fieldDefId: string, value: string | null) {
  const { supabase, orgId } = await requireInternal()
  const v = value?.trim() || null
  const { error } = await supabase
    .from('company_field_values')
    .upsert({ company_id: companyId, field_def_id: fieldDefId, org_id: orgId, value: v }, { onConflict: 'company_id,field_def_id' })
  if (error) throw error
  revalidatePath(`/companies/${companyId}`)
}

// ── Bulk sync (backfill) ──────────────────────────────────────────────────────

/**
 * Backfill Company Profiles from existing data that predates auto-create: every Deal Desk
 * card and every accepted (active) deal without a linked company gets create-or-linked by name.
 * Scoped by the caller's visibility (a founder/admin sees everything; an associate their own cards).
 */
export async function syncCompaniesFromExisting(): Promise<{ cards: number; deals: number }> {
  const { supabase, userId, orgId } = await requireInternal()
  let cards = 0
  let deals = 0

  // Deal Desk cards without a company.
  const { data: unlinkedCards } = await supabase.from('desk_deals').select('*').is('company_id', null)
  for (const deal of unlinkedCards ?? []) {
    try {
      const companyId = await findOrCreateCompanyForDeskDeal(supabase, orgId, userId, deal as Record<string, unknown>)
      if (companyId) { await supabase.from('desk_deals').update({ company_id: companyId }).eq('id', (deal as { id: string }).id); cards++ }
    } catch { /* skip this card */ }
  }

  // Accepted deals (active_deals → pipeline_entries) without a company.
  const { data: activeDeals } = await supabase.from('active_deals').select('entry:pipeline_entries(id, title, company_id, pipeline_id)')
  for (const ad of activeDeals ?? []) {
    const raw = (ad as { entry: unknown }).entry
    const entry = (Array.isArray(raw) ? raw[0] : raw) as { id: string; title: string | null; company_id: string | null; pipeline_id: string } | null
    if (!entry || entry.company_id || !entry.title) continue
    try {
      const { data: pl } = await supabase.from('pipelines').select('org_id').eq('id', entry.pipeline_id).single()
      if (!pl?.org_id) continue
      const res = await findOrCreateCompanyByName(supabase, pl.org_id as string, userId, entry.title)
      if (res) { await supabase.from('pipeline_entries').update({ company_id: res.id }).eq('id', entry.id); deals++ }
    } catch { /* skip this deal */ }
  }

  revalidatePath('/companies')
  return { cards, deals }
}

// ── Linking ─────────────────────────────────────────────────────────────────

export async function linkDeskDealToCompany(deskDealId: string, companyId: string | null) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('desk_deals').update({ company_id: companyId }).eq('id', deskDealId)
  if (error) throw error
  revalidatePath('/deal-desk')
  if (companyId) revalidatePath(`/companies/${companyId}`)
}

export async function linkPipelineEntryToCompany(entryId: string, companyId: string | null) {
  const { supabase } = await requireInternal()
  const { data: entry } = await supabase.from('pipeline_entries').select('pipeline_id').eq('id', entryId).single()
  const { error } = await supabase.from('pipeline_entries').update({ company_id: companyId }).eq('id', entryId)
  if (error) throw error
  if (entry?.pipeline_id) revalidatePath(`/pipelines/${entry.pipeline_id}`)
  if (companyId) revalidatePath(`/companies/${companyId}`)
}

/**
 * Promote a Deal Desk card into a company profile (create-or-link by name), pre-filled from
 * the card, and link the card back. Returns the company id.
 */
export async function promoteDeskDealToCompany(deskDealId: string): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()
  const { data: deal, error: readErr } = await supabase.from('desk_deals').select('*').eq('id', deskDealId).single()
  if (readErr || !deal) throw new Error('Deal Desk card not found.')

  const companyId = await findOrCreateCompanyForDeskDeal(supabase, orgId, userId, deal as Record<string, unknown>)
  if (!companyId) throw new Error('Could not create a company (missing name).')

  await supabase.from('desk_deals').update({ company_id: companyId }).eq('id', deskDealId)
  revalidatePath('/companies')
  revalidatePath('/deal-desk')
  return companyId
}

/**
 * Create a Deal Desk card from a company profile (the reverse of promote), pre-filled from the
 * company and linked back. Authors only (associate/admin), since founders review rather than author.
 */
export async function createDeskDealFromCompany(companyId: string): Promise<void> {
  const { supabase, userId, orgId, role } = await requireRole(['associate', 'admin'])

  // Assignment rule: a card for a company that's in the pipeline can only be created by an
  // assignee of that deal (admins may override). If the deal is unassigned, creating the card
  // claims it — the author is auto-assigned.
  const { data: linked } = await supabase
    .from('pipeline_entries')
    .select('id, pipeline_id, assignees:pipeline_entry_assignees(user_id)')
    .eq('company_id', companyId)
  const entries = (linked ?? []) as Array<{ id: string; pipeline_id: string; assignees: Array<{ user_id: string }> }>
  const assigned = entries.filter((e) => (e.assignees ?? []).length > 0)
  if (assigned.length > 0) {
    const isAssignee = assigned.some((e) => (e.assignees ?? []).some((a) => a.user_id === userId))
    if (!isAssignee && role !== 'admin') {
      throw new Error('This deal is assigned to someone else — only the assignee (or an admin) can create its card.')
    }
  } else if (entries.length > 0) {
    for (const e of entries) {
      await supabase.from('pipeline_entry_assignees').insert({ entry_id: e.id, user_id: userId })
      revalidatePath(`/pipelines/${e.pipeline_id}`)
    }
  }

  const { data: c, error } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (error || !c) throw new Error('Company not found.')
  const company = c as Record<string, any>

  const founders = (company.founders ?? []).map((f: Record<string, any>) => ({
    name: f.name, affiliation: f.ex_affiliations ?? null, bio: f.bio ?? null, linkedin_url: f.linkedin_url ?? null,
  }))

  const { error: insErr } = await supabase.from('desk_deals').insert({
    org_id: orgId,
    associate_id: userId,
    company_id: companyId,
    company_name: String(company.name ?? '').slice(0, 40),
    about: company.one_liner ? String(company.one_liner).slice(0, 50) : null,
    location: company.hq_city ? String(company.hq_city).slice(0, 50) : null,
    sector: company.sectors?.[0] ?? null,
    stage: enumOrNull(DESK_STAGES, company.stage),
    instrument: enumOrNull(DESK_INSTRUMENTS, company.instrument),
    round_status: enumOrNull(DESK_ROUND_STATUSES, company.round_status),
    ask_inr: company.ask_inr ?? null,
    total_raised_inr: company.total_raised_inr ?? null,
    gross_margin_pct: company.gross_margin_pct ?? null,
    monthly_burn_inr: company.monthly_burn_inr ?? null,
    runway_months: company.runway_months ?? null,
    customers_count: company.customers_count ?? null,
    business_model: company.business_model ?? null,
    usp: company.usp ?? null,
    founders,
    seen_status: false,
  })
  if (insErr) throw insErr
  revalidatePath('/deal-desk')
  revalidatePath(`/companies/${companyId}`)
}
