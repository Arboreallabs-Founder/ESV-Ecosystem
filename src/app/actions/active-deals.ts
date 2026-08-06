'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/guards'
import { findOrCreateCompanyByName } from '@/lib/company-sync'
import { parseDealsCsv } from '@/lib/active-deals-csv'
import { DEAL_STATES } from '@/lib/types'
import type { ActiveDealInvestor, ActiveDealInvestorFee, ActiveDealInvestorStatus, DealCategory, DealState } from '@/lib/types'

type DealCategoryFieldRow = DealCategory['fields'][number]
type DealCategoryRow = Omit<DealCategory, 'fields'> & { fields?: DealCategoryFieldRow[] | null }
type FieldValueRow = { field_id: string; value: string | null }
type UserNameRow = { name: string | null; photo_url: string | null }
type EntryAssigneeRow = { user_id: string; user?: UserNameRow | UserNameRow[] | null }
type ActiveDealEntryListRow = {
  title: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitted_at: string
  pipeline_id: string
  assignees?: EntryAssigneeRow[] | null
}
type ActiveDealListRow = {
  id: string
  pipeline_entry_id: string
  created_at: string
  deal_state: DealState | null
  logo_url: string | null
  visible_to_partners?: boolean | null
  entry?: ActiveDealEntryListRow | ActiveDealEntryListRow[] | null
  categories?: Array<{ category?: DealCategoryRow | null }> | null
  field_values?: FieldValueRow[] | null
}
type ReferralInvestorRow = { id: string; referred_by_partner_id: string | null }
type InsertedIdRow = { id: string }
type DealInvestorRow = Omit<ActiveDealInvestor, 'investor' | 'fees'> & {
  investor: ActiveDealInvestor['investor'] | ActiveDealInvestor['investor'][] | null
  fees?: ActiveDealInvestorFee[] | null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function sortCategoryFields(fields: DealCategoryFieldRow[] | null | undefined): DealCategoryFieldRow[] {
  return [...(fields ?? [])].sort((a, b) => a.position - b.position)
}

async function requireAdmin() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, userId, orgId }
}

async function requireInternal() {
  const { supabase, userId, orgId, role } = await requireRole(['founder', 'admin', 'associate'])
  return { supabase, userId, orgId, role }
}

async function requireInternalOrPartner() {
  const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate', 'franchise_partner'])
  return { supabase, userId, role }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<DealCategory[]> {
  const { supabase } = await requireInternal()
  const { data } = await supabase
    .from('deal_categories')
    .select('*, fields:deal_category_fields(*)')
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as DealCategoryRow[]
  return rows.map((c) => ({
    ...c,
    fields: sortCategoryFields(c.fields),
  }))
}

export async function createCategory(name: string, description: string, color: string) {
  const { supabase, userId, orgId } = await requireAdmin()
  const { data, error } = await supabase
    .from('deal_categories')
    .insert({ name: name.trim(), description: description.trim() || null, color, created_by: userId, org_id: orgId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateCategory(id: string, name: string, description: string, color: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('deal_categories')
    .update({ name: name.trim(), description: description.trim() || null, color })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('deal_categories').delete().eq('id', id)
  if (error) throw error
}

// ── Category Fields ───────────────────────────────────────────────────────────

export async function addCategoryField(
  categoryId: string,
  label: string,
  fieldType: 'text' | 'numeric' | 'percentage' | 'url',
  required: boolean,
  position: number,
) {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('deal_category_fields')
    .insert({ category_id: categoryId, label: label.trim(), field_type: fieldType, required, position })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateCategoryField(
  fieldId: string,
  label: string,
  fieldType: 'text' | 'numeric' | 'percentage' | 'url',
  required: boolean,
) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('deal_category_fields')
    .update({ label: label.trim(), field_type: fieldType, required })
    .eq('id', fieldId)
  if (error) throw error
}

export async function deleteCategoryField(fieldId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('deal_category_fields').delete().eq('id', fieldId)
  if (error) throw error
}

// ── Active Deals List (for client-side overlay) ───────────────────────────────

export async function getActiveDealsData(): Promise<{ deals: import('@/lib/types').ActiveDeal[]; categories: import('@/lib/types').DealCategory[]; userRole: string }> {
  const { supabase, role } = await requireInternalOrPartner()
  const [dealsRes, catsRes] = await Promise.all([
    supabase.from('active_deals').select(`
      id, pipeline_entry_id, created_at, deal_state, logo_url, visible_to_partners,
      entry:pipeline_entries(title, submitter_name, submitter_email, submitted_at, pipeline_id, assignees:pipeline_entry_assignees(user_id, user:users(name, photo_url))),
      categories:active_deal_categories(category:deal_categories(id, name, description, color, created_at, fields:deal_category_fields(*))),
      field_values:active_deal_field_values(field_id, value)
    `).order('created_at', { ascending: false }),
    supabase.from('deal_categories').select('*, fields:deal_category_fields(*)').order('created_at', { ascending: true }),
  ])
  const deals = ((dealsRes.data ?? []) as unknown as ActiveDealListRow[]).map((row) => {
    const allFieldValues = row.field_values ?? []
    return {
      id: row.id,
      pipeline_entry_id: row.pipeline_entry_id,
      created_at: row.created_at,
      deal_state: (row.deal_state ?? 'active') as import('@/lib/types').DealState,
      logo_url: row.logo_url ?? null,
      visible_to_partners: row.visible_to_partners !== false,
      entry: (() => {
        const e = first(row.entry)
        if (!e) {
          return {
            title: null,
            submitter_name: null,
            submitter_email: null,
            submitted_at: row.created_at,
            pipeline_id: '',
            assignees: [],
          }
        }
        return {
          ...e,
          assignees: (e.assignees ?? []).map((a) => ({ user_id: a.user_id, name: first(a.user)?.name ?? 'Unknown', photo_url: first(a.user)?.photo_url ?? null })),
        }
      })(),
      categories: (row.categories ?? []).map((c) => {
        const fields = sortCategoryFields(c.category?.fields)
        const catFieldIds = new Set(fields.map((f) => f.id))
        return {
          category: { ...c.category!, fields },
          field_values: allFieldValues.filter((fv) => catFieldIds.has(fv.field_id)),
        }
      }),
    }
  })
  const categories = ((catsRes.data ?? []) as DealCategoryRow[]).map((c) => ({ ...c, fields: sortCategoryFields(c.fields) }))
  return { deals, categories, userRole: role }
}

// ── Accept Deal ───────────────────────────────────────────────────────────────

export async function acceptDeal(
  entryId: string,
  stageId: string,
  selections: Array<{
    categoryId: string
    fieldValues: Record<string, string> // fieldId → value
  }>,
) {
  const { supabase, userId, role } = await requireInternal()
  if (role === 'associate') {
    const { data } = await supabase
      .from('pipeline_entry_assignees')
      .select('user_id')
      .eq('entry_id', entryId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) throw new Error('Associates can only accept entries assigned to them.')
  }

  // Move entry to accepted stage
  await supabase.from('pipeline_entries').update({ stage_id: stageId }).eq('id', entryId)

  // Every accepted deal materialises into a Company Profile (create-or-link by name), unless
  // the entry is already linked. org_id comes from the parent pipeline (entries have none).
  const { data: entryRow } = await supabase.from('pipeline_entries').select('title, company_id, pipeline_id').eq('id', entryId).single()
  let resolvedCompanyId: string | null = entryRow?.company_id ?? null
  if (entryRow && !entryRow.company_id && entryRow.title) {
    const { data: pl } = await supabase.from('pipelines').select('org_id').eq('id', entryRow.pipeline_id).single()
    if (pl?.org_id) {
      try {
        const res = await findOrCreateCompanyByName(supabase, pl.org_id as string, userId, entryRow.title as string)
        if (res) { await supabase.from('pipeline_entries').update({ company_id: res.id }).eq('id', entryId); resolvedCompanyId = res.id }
      } catch { /* non-fatal: acceptance shouldn't fail if company sync hiccups */ }
    }
  }

  // Accepting always means the deal is active — percolate that into the linked company profile.
  await syncCompanyStatusFromDealState(supabase, resolvedCompanyId, 'active')

  // If this entry was already accepted before (its active deal lingers after being
  // moved out of Accepted), re-accepting just moves it back — don't create a second
  // active deal; preserve the existing one's investors, fees, and categories.
  const { data: existingDeal } = await supabase
    .from('active_deals')
    .select('id')
    .eq('pipeline_entry_id', entryId)
    .maybeSingle()
  if (existingDeal) return

  // Create active deal record
  const { data: activeDeal, error: dealErr } = await supabase
    .from('active_deals')
    .insert({ pipeline_entry_id: entryId })
    .select('id')
    .single()
  if (dealErr) throw dealErr

  if (selections.length === 0) return

  // Link categories
  await supabase.from('active_deal_categories').insert(
    selections.map((s) => ({ active_deal_id: activeDeal.id, category_id: s.categoryId }))
  )

  // Insert field values (flatten all selections)
  const allValues = selections.flatMap((s) =>
    Object.entries(s.fieldValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([fieldId, value]) => ({ active_deal_id: activeDeal.id, field_id: fieldId, value: value.trim() }))
  )
  if (allValues.length > 0) {
    await supabase.from('active_deal_field_values').insert(allValues)
  }
}

// ── Deal state (lifecycle) ──────────────────────────────────────────────────────

// A deal reaching Active/Closed percolates into the linked company's own profile status —
// Dormant/Archived don't map cleanly to a lifecycle stage, so they're left untouched. This only
// ever sets a status forward; founders/admins can still manually override it afterward.
async function syncCompanyStatusFromDealState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, companyId: string | null | undefined, state: DealState,
) {
  if (!companyId) return
  if (state === 'active') await supabase.from('companies').update({ status: 'active' }).eq('id', companyId)
  else if (state === 'closed') await supabase.from('companies').update({ status: 'portfolio' }).eq('id', companyId)
}

export async function updateDealState(activeDealId: string, state: DealState) {
  const { supabase } = await requireInternal()
  if (!DEAL_STATES.includes(state)) throw new Error('Invalid deal state.')
  const { error } = await supabase.from('active_deals').update({ deal_state: state }).eq('id', activeDealId)
  if (error) throw error

  const { data: deal } = await supabase
    .from('active_deals')
    .select('entry:pipeline_entries(company_id)')
    .eq('id', activeDealId)
    .single()
  await syncCompanyStatusFromDealState(supabase, first(deal?.entry as { company_id: string | null } | { company_id: string | null }[] | null)?.company_id, state)

  revalidatePath('/active-deals')
}

// Full teardown for a test/mistaken deal — removes the active deal record and everything
// hanging off it, plus the pipeline entry/lead it was accepted from (so it's gone from the
// Pipelines board too, not just Active Deals). Founder/admin only; deliberately not
// revalidatePath-scoped to the pipeline since we don't have its id handy — the board
// refetches on next navigation.
export async function deleteActiveDeal(activeDealId: string) {
  const { supabase } = await requireAdmin()

  const { data: deal, error: dealErr } = await supabase
    .from('active_deals')
    .select('pipeline_entry_id')
    .eq('id', activeDealId)
    .single()
  if (dealErr || !deal) throw new Error('Active deal not found.')

  const { data: investorRows } = await supabase
    .from('active_deal_investors')
    .select('id')
    .eq('active_deal_id', activeDealId)
  const investorIds = (investorRows ?? []).map((r: { id: string }) => r.id)
  if (investorIds.length > 0) {
    const { error } = await supabase.from('active_deal_investor_fees').delete().in('active_deal_investor_id', investorIds)
    if (error) throw error
  }

  let res = await supabase.from('active_deal_investors').delete().eq('active_deal_id', activeDealId)
  if (res.error) throw res.error
  res = await supabase.from('active_deal_field_values').delete().eq('active_deal_id', activeDealId)
  if (res.error) throw res.error
  res = await supabase.from('active_deal_categories').delete().eq('active_deal_id', activeDealId)
  if (res.error) throw res.error
  res = await supabase.from('active_deal_partner_shares').delete().eq('active_deal_id', activeDealId)
  if (res.error) throw res.error

  const { error: dealDeleteErr } = await supabase.from('active_deals').delete().eq('id', activeDealId)
  if (dealDeleteErr) throw dealDeleteErr

  // Cascades to pipeline_entry_assignees, stage history, form answers, etc.
  const { error: entryDeleteErr } = await supabase.from('pipeline_entries').delete().eq('id', deal.pipeline_entry_id)
  if (entryDeleteErr) throw entryDeleteErr

  revalidatePath('/active-deals')
}

export async function updateActiveDealDetails(activeDealId: string, input: {
  deal_name: string
  selections?: Array<{ category_id: string; field_values: Record<string, string> }>
  submitter_name?: string | null
  submitter_email?: string | null
  logo_url?: string | null
}) {
  const { supabase } = await requireInternal()
  const name = input.deal_name.trim()
  if (!name) throw new Error('Deal name is required.')

  const { data: deal, error: dealErr } = await supabase
    .from('active_deals')
    .select('pipeline_entry_id')
    .eq('id', activeDealId)
    .single()
  if (dealErr || !deal) throw new Error('Active deal not found.')

  const { error: entryErr } = await supabase
    .from('pipeline_entries')
    .update({
      title: name,
      submitter_name: input.submitter_name?.trim() || null,
      submitter_email: input.submitter_email?.trim() || null,
    })
    .eq('id', deal.pipeline_entry_id)
  if (entryErr) throw entryErr

  if ('logo_url' in input) {
    const { error: logoErr } = await supabase
      .from('active_deals')
      .update({ logo_url: input.logo_url?.trim() || null })
      .eq('id', activeDealId)
    if (logoErr) throw logoErr
  }

  if ('selections' in input) {
    const selections = input.selections ?? []
    const categoryIds = selections.map((s) => s.category_id)
    const { data: fields } = categoryIds.length > 0
      ? await supabase.from('deal_category_fields').select('id, category_id, field_type, label').in('category_id', categoryIds)
      : { data: [] }
    const allowedFieldIds = new Set((fields ?? []).map((f: { id: string }) => f.id))

    let res = await supabase.from('active_deal_field_values').delete().eq('active_deal_id', activeDealId)
    if (res.error) throw res.error
    res = await supabase.from('active_deal_categories').delete().eq('active_deal_id', activeDealId)
    if (res.error) throw res.error

    if (categoryIds.length > 0) {
      const { error } = await supabase
        .from('active_deal_categories')
        .insert(categoryIds.map((category_id) => ({ active_deal_id: activeDealId, category_id })))
      if (error) throw error
    }

    const rows = selections
      .flatMap((s) => Object.entries(s.field_values))
      .filter(([fieldId, value]) => allowedFieldIds.has(fieldId) && value.trim())
      .map(([field_id, value]) => ({ active_deal_id: activeDealId, field_id, value: value.trim() }))
    if (rows.length > 0) {
      const { error } = await supabase.from('active_deal_field_values').insert(rows)
      if (error) throw error
    }

    const { data: investorRows } = await supabase
      .from('active_deal_investors')
      .select('id, category_id')
      .eq('active_deal_id', activeDealId)
    const investorIds = (investorRows ?? []).map((r: { id: string }) => r.id)
    if (investorIds.length > 0) {
      const { error } = await supabase
        .from('active_deal_investor_fees')
        .delete()
        .in('active_deal_investor_id', investorIds)
        .not('source_field_id', 'is', null)
      if (error) throw error

      // Only give an investor fee stubs from their OWN category's percentage fields —
      // not every percentage field across all of the deal's categories.
      const pctFields = (fields ?? []).filter((f: { field_type: string }) => f.field_type === 'percentage')
      const feeRows = (investorRows ?? []).flatMap((inv: { id: string; category_id: string | null }) =>
        pctFields
          .filter((f: { category_id: string }) => f.category_id === inv.category_id)
          .map((f: { id: string; label: string }) => ({
            active_deal_investor_id: inv.id,
            label: f.label,
            rate: null,
            source_field_id: f.id,
            is_enabled: true,
          }))
      )
      if (feeRows.length > 0) {
        const { error: feeErr } = await supabase.from('active_deal_investor_fees').insert(feeRows)
        if (feeErr) throw feeErr
      }
    }
  }

  revalidatePath('/active-deals')
  revalidatePath(`/active-deals/${activeDealId}`)
}

export async function linkActiveDealToCompany(activeDealId: string, companyId: string | null) {
  const { supabase } = await requireInternal()
  const { data: deal, error: dealErr } = await supabase
    .from('active_deals')
    .select('pipeline_entry_id')
    .eq('id', activeDealId)
    .single()
  if (dealErr || !deal) throw new Error('Active deal not found.')

  const { data: entry } = await supabase
    .from('pipeline_entries')
    .select('company_id')
    .eq('id', deal.pipeline_entry_id)
    .single()

  const previousCompanyId = entry?.company_id as string | null | undefined
  const { error } = await supabase
    .from('pipeline_entries')
    .update({ company_id: companyId })
    .eq('id', deal.pipeline_entry_id)
  if (error) throw error

  revalidatePath('/active-deals')
  revalidatePath(`/active-deals/${activeDealId}`)
  revalidatePath('/companies')
  if (companyId) revalidatePath(`/companies/${companyId}`)
  if (previousCompanyId) revalidatePath(`/companies/${previousCompanyId}`)
}

export async function createOrLinkCompanyForActiveDeal(activeDealId: string): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()
  if (!orgId) throw new Error('No organisation in scope.')

  const { data: deal, error: dealErr } = await supabase
    .from('active_deals')
    .select('pipeline_entry_id, entry:pipeline_entries(title)')
    .eq('id', activeDealId)
    .single()
  if (dealErr || !deal) throw new Error('Active deal not found.')
  const entry = Array.isArray(deal.entry) ? deal.entry[0] : deal.entry
  const title = entry?.title?.trim()
  if (!title) throw new Error('Deal name is required before creating a company profile.')

  const company = await findOrCreateCompanyByName(supabase, orgId, userId, title)
  if (!company?.id) throw new Error('Could not create or link a company profile.')

  const { error } = await supabase
    .from('pipeline_entries')
    .update({ company_id: company.id })
    .eq('id', deal.pipeline_entry_id)
  if (error) throw error

  revalidatePath('/active-deals')
  revalidatePath(`/active-deals/${activeDealId}`)
  revalidatePath('/companies')
  revalidatePath(`/companies/${company.id}`)
  return company.id as string
}

// ── Create / import standalone deals (portfolio & off-pipeline) ─────────────────
// Active deals require a pipeline_entry, so directly-created deals live in a dedicated
// per-org "Imported Deals" pipeline (at its Accepted stage). Each row create-or-links a
// company by name and links the entry to it, so the deal reflects on the company profile.

const IMPORT_PIPELINE_NAME = 'Imported Deals'

async function ensureImportPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, orgId: string, userId: string,
): Promise<{ pipelineId: string; acceptedStageId: string }> {
  const { data: found } = await supabase
    .from('pipelines').select('id').eq('org_id', orgId).eq('name', IMPORT_PIPELINE_NAME).limit(1)
  let pipelineId = found?.[0]?.id as string | undefined
  if (!pipelineId) {
    const { data: created, error } = await supabase
      .from('pipelines')
      .insert({ name: IMPORT_PIPELINE_NAME, description: 'Portfolio & off-pipeline deals added directly to Active Deals.', created_by: userId, org_id: orgId })
      .select('id').single()
    if (error) throw error
    pipelineId = created.id as string
    await supabase.from('pipeline_stages').insert([
      { pipeline_id: pipelineId, name: 'Lead', color: '#745FFD', position: -1, stage_type: 'lead' },
      { pipeline_id: pipelineId, name: 'Accepted', color: '#16a34a', position: 998, stage_type: 'accepted' },
      { pipeline_id: pipelineId, name: 'Rejected', color: '#dc2626', position: 999, stage_type: 'rejected' },
    ])
  }
  const { data: stage } = await supabase
    .from('pipeline_stages').select('id').eq('pipeline_id', pipelineId).eq('stage_type', 'accepted').limit(1)
  const acceptedStageId = stage?.[0]?.id as string | undefined
  if (!acceptedStageId) throw new Error('The Imported Deals pipeline is missing an Accepted stage.')
  return { pipelineId, acceptedStageId }
}

type StandaloneDealInput = {
  deal_name: string
  categories: Array<{ category_id: string; field_values: Record<string, string> }>
  submitter_name: string | null
  submitter_email: string | null
  // Set when the deal is created FROM a company profile — links directly to that company
  // instead of matching by name (avoids any name-drift ambiguity).
  company_id?: string | null
}

async function insertStandaloneDeal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, importPipeline: { pipelineId: string; acceptedStageId: string }, orgId: string, userId: string, row: StandaloneDealInput,
): Promise<string> {
  const { data: entry, error: entryErr } = await supabase
    .from('pipeline_entries')
    .insert({ pipeline_id: importPipeline.pipelineId, stage_id: importPipeline.acceptedStageId, title: row.deal_name, submitter_name: row.submitter_name, submitter_email: row.submitter_email })
    .select('id').single()
  if (entryErr) throw entryErr
  const entryId = entry.id as string

  // Link to a company: directly, if one was already chosen (created from its profile); otherwise
  // materialise/find one by name (create-or-link), so every deal has a company profile behind it.
  let resolvedCompanyId: string | null = row.company_id ?? null
  try {
    if (row.company_id) {
      await supabase.from('pipeline_entries').update({ company_id: row.company_id }).eq('id', entryId)
    } else {
      const res = await findOrCreateCompanyByName(supabase, orgId, userId, row.deal_name)
      if (res) { await supabase.from('pipeline_entries').update({ company_id: res.id }).eq('id', entryId); resolvedCompanyId = res.id }
    }
  } catch { /* non-fatal: don't fail the deal if company sync hiccups */ }

  // A freshly created standalone deal always starts active — percolate that into the company.
  await syncCompanyStatusFromDealState(supabase, resolvedCompanyId, 'active')

  const { data: deal, error: dealErr } = await supabase
    .from('active_deals').insert({ pipeline_entry_id: entryId }).select('id').single()
  if (dealErr) throw dealErr

  if (row.categories.length > 0) {
    await supabase.from('active_deal_categories').insert(
      row.categories.map((c) => ({ active_deal_id: deal.id, category_id: c.category_id }))
    )
    const values = row.categories
      .flatMap((c) => Object.entries(c.field_values))
      .filter(([, v]) => v && v.trim() !== '')
      .map(([field_id, value]) => ({ active_deal_id: deal.id, field_id, value: value.trim() }))
    if (values.length > 0) await supabase.from('active_deal_field_values').insert(values)
  }
  return deal.id as string
}

export async function createStandaloneDeal(input: {
  deal_name: string
  selections?: Array<{ category_id: string; field_values: Record<string, string> }>
  submitter_name?: string | null
  submitter_email?: string | null
  company_id?: string | null
}): Promise<string> {
  const { supabase, userId, orgId } = await requireInternal()
  if (!orgId) throw new Error('No organisation in scope.')
  const name = input.deal_name.trim()
  if (!name) throw new Error('Deal name is required.')
  const importPipeline = await ensureImportPipeline(supabase, orgId, userId)
  const id = await insertStandaloneDeal(supabase, importPipeline, orgId, userId, {
    deal_name: name,
    categories: input.selections ?? [],
    submitter_name: input.submitter_name?.trim() || null,
    submitter_email: input.submitter_email?.trim() || null,
    company_id: input.company_id ?? null,
  })
  revalidatePath('/active-deals'); revalidatePath('/companies'); revalidatePath(`/pipelines/${importPipeline.pipelineId}`)
  return id
}

export async function importActiveDealsCsv(csvText: string): Promise<{ created: number; errors: { row: number; message: string }[] }> {
  const { supabase, userId, orgId } = await requireAdmin()
  if (!orgId) throw new Error('No organisation in scope.')

  // Categories drive the dynamic columns; read them the same shape getCategories() returns.
  const { data: catData } = await supabase
    .from('deal_categories').select('*, fields:deal_category_fields(*)').order('created_at', { ascending: true })
  const categories: DealCategory[] = ((catData ?? []) as DealCategory[]).map((c) => ({ ...c, fields: [...(c.fields ?? [])].sort((a, b) => a.position - b.position) }))

  const { rows, errors } = parseDealsCsv(csvText, categories)
  if (rows.length === 0) return { created: 0, errors }

  const importPipeline = await ensureImportPipeline(supabase, orgId, userId)
  let created = 0
  for (let i = 0; i < rows.length; i++) {
    try { await insertStandaloneDeal(supabase, importPipeline, orgId, userId, rows[i]); created++ }
    catch (e) { errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Failed to import row.' }) }
  }
  revalidatePath('/active-deals'); revalidatePath('/companies'); revalidatePath(`/pipelines/${importPipeline.pipelineId}`)
  return { created, errors }
}

// ── Form modal support data ───────────────────────────────────────────────────

export async function getInternalUsers(): Promise<Array<{ id: string; name: string }>> {
  const { supabase } = await requireInternal()
  const { data } = await supabase
    .from('users')
    .select('id, name')
    .in('role', ['founder', 'admin', 'associate'])
    .order('name', { ascending: true })
  return (data ?? []) as Array<{ id: string; name: string }>
}

export async function getFranchisePartners(): Promise<Array<{ id: string; name: string }>> {
  const { supabase } = await requireInternal()
  const { data } = await supabase
    .from('franchise_partners')
    .select('id, name')
    .order('name', { ascending: true })
  return (data ?? []) as Array<{ id: string; name: string }>
}

// ── Investor picker data ──────────────────────────────────────────────────────

export async function getInvestorsForPicker(): Promise<Array<{
  id: string
  name: string
  service_type: string
  referred_by_partner_id: string | null
}>> {
  const { supabase } = await requireInternal()
  const { data } = await supabase
    .from('investors')
    .select('id, name, service_type, referred_by_partner_id')
    .order('name', { ascending: true })
  return (data ?? []) as Array<{ id: string; name: string; service_type: string; referred_by_partner_id: string | null }>
}

// ── Deal Investors ────────────────────────────────────────────────────────────

const DEAL_INVESTOR_SELECT = `
  id, active_deal_id, category_id, is_investing, investment_amount, is_referral, status, shares, created_at,
  investor:investors(id, name, service_type, referred_by_partner_id),
  fees:active_deal_investor_fees(id, label, rate, source_field_id, is_enabled)
`

function shapeDealInvestor(row: DealInvestorRow): ActiveDealInvestor {
  return {
    id: row.id,
    active_deal_id: row.active_deal_id,
    category_id: row.category_id,
    is_investing: row.is_investing,
    investment_amount: row.investment_amount,
    is_referral: row.is_referral,
    status: row.status ?? 'not_started',
    shares: row.shares,
    created_at: row.created_at,
    investor: first(row.investor)!,
    fees: row.fees ?? [],
  }
}

// A category's percentage fields become auto-populated fee rows on investors added under it.
async function pctFieldsForCategory(supabase: SupabaseClient, categoryId: string): Promise<Array<{ id: string; label: string }>> {
  const { data } = await supabase
    .from('deal_category_fields')
    .select('id, label')
    .eq('category_id', categoryId)
    .eq('field_type', 'percentage')
  return (data ?? []) as Array<{ id: string; label: string }>
}

export async function getDealInvestors(activeDealId: string): Promise<{
  investors: ActiveDealInvestor[]
  dealFieldValues: Array<{ field_id: string; value: string | null }>
}> {
  const { supabase } = await requireInternalOrPartner()
  const [investorsRes, fieldValuesRes] = await Promise.all([
    supabase
      .from('active_deal_investors')
      .select(DEAL_INVESTOR_SELECT)
      .eq('active_deal_id', activeDealId)
      .order('created_at', { ascending: true }),
    supabase
      .from('active_deal_field_values')
      .select('field_id, value')
      .eq('active_deal_id', activeDealId),
  ])

  return {
    investors: (investorsRes.data ?? []).map(shapeDealInvestor),
    dealFieldValues: (fieldValuesRes.data ?? []) as Array<{ field_id: string; value: string | null }>,
  }
}

export async function addInvestorToDeal(activeDealId: string, investorId: string, categoryId: string | null): Promise<ActiveDealInvestor> {
  const [created] = await addInvestorsToDeal(activeDealId, [investorId], categoryId)
  return created
}

// Bulk-add: attach several investors to a deal in one go (used by the table view's
// multi-select picker), scoped to one of the deal's categories (or null = Unassigned).
// Each new row gets fee stubs from that category's percentage fields.
export async function addInvestorsToDeal(activeDealId: string, investorIds: string[], categoryId: string | null): Promise<ActiveDealInvestor[]> {
  const { supabase } = await requireInternal()
  const ids = [...new Set(investorIds.filter(Boolean))]
  if (ids.length === 0) return []

  // Which of these are referrals? One lookup for all.
  const { data: invRows } = await supabase
    .from('investors')
    .select('id, referred_by_partner_id')
    .in('id', ids)
  const referralById = new Map<string, boolean>(((invRows ?? []) as ReferralInvestorRow[]).map((r) => [r.id, !!r.referred_by_partner_id]))

  const { data: inserted, error } = await supabase
    .from('active_deal_investors')
    .insert(ids.map((investorId) => ({
      active_deal_id: activeDealId,
      investor_id: investorId,
      category_id: categoryId,
      is_referral: referralById.get(investorId) ?? false,
    })))
    .select('id')
  if (error) throw error

  const newIds = ((inserted ?? []) as InsertedIdRow[]).map((r) => r.id)

  // Auto-populate fee stubs from this category's percentage fields.
  const pctFields = categoryId ? await pctFieldsForCategory(supabase, categoryId) : []
  if (pctFields.length > 0 && newIds.length > 0) {
    await supabase.from('active_deal_investor_fees').insert(
      newIds.flatMap((investorRowId) =>
        pctFields.map((f) => ({
          active_deal_investor_id: investorRowId,
          label: f.label,
          rate: null,
          source_field_id: f.id,
          is_enabled: true,
        }))
      )
    )
  }

  const { data: full } = await supabase
    .from('active_deal_investors')
    .select(DEAL_INVESTOR_SELECT)
    .in('id', newIds)
    .order('created_at', { ascending: true })
  return ((full ?? []) as unknown as DealInvestorRow[]).map(shapeDealInvestor)
}

export async function removeInvestorFromDeal(activeDealInvestorId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('active_deal_investors').delete().eq('id', activeDealInvestorId)
  if (error) throw error
}

export async function updateDealInvestor(id: string, updates: {
  is_investing?: boolean
  investment_amount?: number | null
  status?: ActiveDealInvestorStatus
  shares?: number | null
}) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('active_deal_investors').update(updates).eq('id', id)
  if (error) throw error
}

export async function upsertInvestorFee(
  activeDealInvestorId: string,
  params: { id?: string; label: string; rate: number | null; source_field_id?: string | null }
) {
  const { supabase } = await requireInternal()
  if (params.id) {
    const { error } = await supabase
      .from('active_deal_investor_fees')
      .update({ label: params.label.trim(), rate: params.rate })
      .eq('id', params.id)
    if (error) throw error
  } else {
    const { data, error } = await supabase
      .from('active_deal_investor_fees')
      .insert({
        active_deal_investor_id: activeDealInvestorId,
        label: params.label.trim(),
        rate: params.rate,
        source_field_id: params.source_field_id ?? null,
        is_enabled: true,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }
}

export async function toggleInvestorFee(feeId: string, is_enabled: boolean) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('active_deal_investor_fees').update({ is_enabled }).eq('id', feeId)
  if (error) throw error
}

export async function deleteInvestorFee(feeId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('active_deal_investor_fees').delete().eq('id', feeId)
  if (error) throw error
}

/**
 * Show or hide a deal on the partner portal.
 *
 * Founder/admin only — associates can edit deals but this is a disclosure decision, which is a
 * different kind of call from editing a field. RLS enforces the read side; this guards the write.
 */
export async function setDealPartnerVisibility(activeDealId: string, visible: boolean) {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('active_deals')
    .update({ visible_to_partners: visible })
    .eq('id', activeDealId)
    .select('id')

  if (error) throw error
  // An UPDATE that RLS filters out succeeds having changed nothing, so the caller would be told
  // their change saved when it had not.
  if (!data || data.length === 0) {
    throw new Error('That deal could not be updated — it may have been removed.')
  }

  revalidatePath('/active-deals')
  revalidatePath('/portal')
}
