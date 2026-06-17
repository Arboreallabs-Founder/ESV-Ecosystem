'use server'

import { requireRole } from '@/lib/guards'
import type { ActiveDealInvestor, DealCategory } from '@/lib/types'

async function requireAdmin() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, userId, orgId }
}

async function requireInternal() {
  const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate'])
  return { supabase, userId, role }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<DealCategory[]> {
  const { supabase } = await requireInternal()
  const { data } = await supabase
    .from('deal_categories')
    .select('*, fields:deal_category_fields(*)')
    .order('created_at', { ascending: true })
  if (!data) return []
  return data.map((c: any) => ({
    ...c,
    fields: (c.fields ?? []).sort((a: any, b: any) => a.position - b.position),
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

export async function getActiveDealsData(): Promise<{ deals: import('@/lib/types').ActiveDeal[]; categories: import('@/lib/types').DealCategory[] }> {
  const { supabase } = await requireInternal()
  const [dealsRes, catsRes] = await Promise.all([
    supabase.from('active_deals').select(`
      id, pipeline_entry_id, created_at,
      entry:pipeline_entries(title, submitter_name, submitter_email, submitted_at, pipeline_id, assignees:pipeline_entry_assignees(user_id, user:users(name))),
      categories:active_deal_categories(category:deal_categories(id, name, description, color, created_at, fields:deal_category_fields(*))),
      field_values:active_deal_field_values(field_id, value)
    `).order('created_at', { ascending: false }),
    supabase.from('deal_categories').select('*, fields:deal_category_fields(*)').order('created_at', { ascending: true }),
  ])
  const deals = (dealsRes.data ?? []).map((row: any) => {
    const allFieldValues = row.field_values ?? []
    return {
      id: row.id,
      pipeline_entry_id: row.pipeline_entry_id,
      created_at: row.created_at,
      entry: (() => {
        const e = Array.isArray(row.entry) ? row.entry[0] : row.entry
        if (!e) return e
        return { ...e, assignees: (e.assignees ?? []).map((a: any) => ({ user_id: a.user_id, name: a.user?.name ?? 'Unknown' })) }
      })(),
      categories: (row.categories ?? []).map((c: any) => {
        const catFieldIds = new Set((c.category?.fields ?? []).map((f: any) => f.id))
        return {
          category: { ...c.category, fields: (c.category?.fields ?? []).sort((a: any, b: any) => a.position - b.position) },
          field_values: allFieldValues.filter((fv: any) => catFieldIds.has(fv.field_id)),
        }
      }),
    }
  })
  const categories = (catsRes.data ?? []).map((c: any) => ({ ...c, fields: (c.fields ?? []).sort((a: any, b: any) => a.position - b.position) }))
  return { deals, categories }
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

export async function getDealInvestors(activeDealId: string): Promise<{
  investors: ActiveDealInvestor[]
  dealFieldValues: Array<{ field_id: string; value: string | null }>
}> {
  const { supabase } = await requireInternal()
  const [investorsRes, fieldValuesRes] = await Promise.all([
    supabase
      .from('active_deal_investors')
      .select(`
        id, active_deal_id, is_investing, investment_amount, is_referral, created_at,
        investor:investors(id, name, service_type, referred_by_partner_id),
        fees:active_deal_investor_fees(id, label, rate, source_field_id, is_enabled)
      `)
      .eq('active_deal_id', activeDealId)
      .order('created_at', { ascending: true }),
    supabase
      .from('active_deal_field_values')
      .select('field_id, value')
      .eq('active_deal_id', activeDealId),
  ])

  const investors: ActiveDealInvestor[] = (investorsRes.data ?? []).map((row: any) => ({
    id: row.id,
    active_deal_id: row.active_deal_id,
    is_investing: row.is_investing,
    investment_amount: row.investment_amount,
    is_referral: row.is_referral,
    created_at: row.created_at,
    investor: Array.isArray(row.investor) ? row.investor[0] : row.investor,
    fees: row.fees ?? [],
  }))

  return {
    investors,
    dealFieldValues: (fieldValuesRes.data ?? []) as Array<{ field_id: string; value: string | null }>,
  }
}

export async function addInvestorToDeal(activeDealId: string, investorId: string): Promise<ActiveDealInvestor> {
  const { supabase } = await requireInternal()

  // Check if investor is a referral
  const { data: inv } = await supabase
    .from('investors')
    .select('referred_by_partner_id')
    .eq('id', investorId)
    .single()
  const isReferral = !!(inv?.referred_by_partner_id)

  const { data: newRow, error } = await supabase
    .from('active_deal_investors')
    .insert({ active_deal_id: activeDealId, investor_id: investorId, is_referral: isReferral })
    .select('id')
    .single()
  if (error) throw error

  // Auto-populate fee rows from this deal's percentage-type category fields
  const { data: catFields } = await supabase
    .from('active_deal_categories')
    .select('category:deal_categories(fields:deal_category_fields(id, label, field_type))')
    .eq('active_deal_id', activeDealId)

  const pctFields: Array<{ id: string; label: string }> = []
  for (const cat of catFields ?? []) {
    const category = Array.isArray((cat as any).category) ? (cat as any).category[0] : (cat as any).category
    for (const field of category?.fields ?? []) {
      if (field.field_type === 'percentage') pctFields.push({ id: field.id, label: field.label })
    }
  }

  if (pctFields.length > 0) {
    await supabase.from('active_deal_investor_fees').insert(
      pctFields.map((f) => ({
        active_deal_investor_id: newRow.id,
        label: f.label,
        rate: null,
        source_field_id: f.id,
        is_enabled: true,
      }))
    )
  }

  // Return the full investor record
  const { data: full } = await supabase
    .from('active_deal_investors')
    .select(`
      id, active_deal_id, is_investing, investment_amount, is_referral, created_at,
      investor:investors(id, name, service_type, referred_by_partner_id),
      fees:active_deal_investor_fees(id, label, rate, source_field_id, is_enabled)
    `)
    .eq('id', newRow.id)
    .single()

  const row = full as any
  return {
    id: row.id,
    active_deal_id: row.active_deal_id,
    is_investing: row.is_investing,
    investment_amount: row.investment_amount,
    is_referral: row.is_referral,
    created_at: row.created_at,
    investor: Array.isArray(row.investor) ? row.investor[0] : row.investor,
    fees: row.fees ?? [],
  }
}

export async function removeInvestorFromDeal(activeDealInvestorId: string) {
  const { supabase } = await requireInternal()
  const { error } = await supabase.from('active_deal_investors').delete().eq('id', activeDealInvestorId)
  if (error) throw error
}

export async function updateDealInvestor(id: string, updates: { is_investing?: boolean; investment_amount?: number | null }) {
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
