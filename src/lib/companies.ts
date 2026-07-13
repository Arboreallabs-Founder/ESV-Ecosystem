import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Company, CompanyFieldDef, CompanyListItem } from '@/lib/types'

// Database list — trimmed rows, newest-touched first. RLS scopes to the org.
export const fetchCompanies = cache(async (): Promise<CompanyListItem[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, name, logo_url, one_liner, sectors, stage, status, hq_city, hq_country, arr_inr, updated_at')
    .order('updated_at', { ascending: false })
  return (data as CompanyListItem[]) ?? []
})

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

// Full profile with all children + linked deal records.
export const fetchCompany = cache(async (id: string): Promise<Company | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select(`
      *,
      esv_poc:users!esv_poc_id(name),
      funding_rounds:company_funding_rounds(*),
      cap_table:company_cap_table(*),
      documents:company_documents(*),
      updates:company_updates(*, author:users!author_id(name)),
      field_values:company_field_values(field_def_id, value),
      linked_desk_deals:desk_deals!company_id(id, company_name, associate_id, deal_status),
      linked_pipeline_entries:pipeline_entries!company_id(id, title, pipeline_id, stage:pipeline_stages!stage_id(name))
    `)
    .eq('id', id)
    .single()
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    ...(row as unknown as Company),
    esv_poc: one(row.esv_poc as { name: string } | { name: string }[] | null),
    founders: (row.founders as Company['founders']) ?? [],
    team: (row.team as Company['team']) ?? [],
    funding_rounds: ((row.funding_rounds as Company['funding_rounds']) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    cap_table: ((row.cap_table as Company['cap_table']) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    documents: (row.documents as Company['documents']) ?? [],
    updates: ((row.updates as Company['updates']) ?? [])
      .map((u: Record<string, unknown>) => ({ ...(u as unknown as Company['updates'][number]), author: one(u.author as { name: string } | { name: string }[] | null) }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    field_values: (row.field_values as Company['field_values']) ?? [],
    linked_desk_deals: (row.linked_desk_deals as Company['linked_desk_deals']) ?? [],
    linked_pipeline_entries: ((row.linked_pipeline_entries as Record<string, unknown>[]) ?? []).map((e) => ({
      id: e.id as string,
      title: (e.title as string | null) ?? null,
      pipeline_id: e.pipeline_id as string,
      stage_name: one(e.stage as { name: string } | { name: string }[] | null)?.name ?? null,
    })),
  }
})

// Org-level custom-field definitions.
export const fetchCompanyFieldDefs = cache(async (): Promise<CompanyFieldDef[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('company_field_defs')
    .select('id, label, field_type, position')
    .order('position', { ascending: true })
  return (data as CompanyFieldDef[]) ?? []
})

// Lightweight options for a "link company" picker (id + name).
export const fetchCompanyOptions = cache(async (): Promise<Array<{ id: string; name: string }>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('id, name').order('name')
  return (data as Array<{ id: string; name: string }>) ?? []
})
