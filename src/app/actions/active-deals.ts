'use server'

import { requireRole } from '@/lib/guards'
import type { DealCategory } from '@/lib/types'

async function requireAdmin() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, userId, orgId }
}

async function requireInternal() {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  return { supabase }
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
  const { supabase } = await requireInternal()

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
