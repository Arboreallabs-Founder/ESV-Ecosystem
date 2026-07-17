import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ActiveDeal, ActiveDealCategoryData, DealCategory, DealState } from '@/lib/types'

type FieldValueRow = { field_id: string; value: string | null }
type DealCategoryFieldRow = DealCategory['fields'][number]
type DealCategoryRow = Omit<DealCategory, 'fields'> & { fields?: DealCategoryFieldRow[] | null }
type UserNameRow = { name: string | null }
type EntryAssigneeRow = { user_id: string; user?: UserNameRow | UserNameRow[] | null }
type PartnerRow = { id: string; name: string }
type EntryRow = {
  title: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitted_at: string | null
  pipeline_id: string | null
  company_id?: string | null
  company?: PartnerRow | PartnerRow[] | null
  assignees?: EntryAssigneeRow[] | null
  form_link?: {
    creator?: {
      franchise_partner?: PartnerRow | PartnerRow[] | null
    } | Array<{ franchise_partner?: PartnerRow | PartnerRow[] | null }> | null
  } | Array<{
    creator?: {
      franchise_partner?: PartnerRow | PartnerRow[] | null
    } | Array<{ franchise_partner?: PartnerRow | PartnerRow[] | null }> | null
  }> | null
}
type ActiveDealRow = {
  id: string
  pipeline_entry_id: string
  created_at: string
  deal_state: DealState | null
  entry?: EntryRow | EntryRow[] | null
  categories?: Array<{ category?: DealCategoryRow | DealCategoryRow[] | null }> | null
  field_values?: FieldValueRow[] | null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function sortFields(fields: DealCategoryFieldRow[] | null | undefined): DealCategoryFieldRow[] {
  return [...(fields ?? [])].sort((a, b) => a.position - b.position)
}

export const fetchCategories = cache(async (): Promise<DealCategory[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_categories')
    .select('*, fields:deal_category_fields(*)')
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as DealCategoryRow[]
  return rows.map((c) => ({
    ...c,
    fields: sortFields(c.fields),
  }))
})

const ACTIVE_DEAL_SELECT = `
  id,
  pipeline_entry_id,
  created_at,
  deal_state,
  entry:pipeline_entries(title, submitter_name, submitter_email, submitted_at, pipeline_id, company_id, company:companies!company_id(id, name), assignees:pipeline_entry_assignees(user_id, user:users(name)), form_link:form_links!form_link_id(creator:users!created_by(franchise_partner:franchise_partners!franchise_partner_id(id, name)))),
  categories:active_deal_categories(
    category:deal_categories(
      id, name, description, color, created_at,
      fields:deal_category_fields(*)
    )
  ),
  field_values:active_deal_field_values(field_id, value)
`

function shapeActiveDealRow(row: ActiveDealRow): ActiveDeal {
  const allFieldValues = row.field_values ?? []
  const entry = first(row.entry)
  const formLink = first(entry?.form_link)
  const creator = first(formLink?.creator)
  const fp = first(creator?.franchise_partner)
  const company = first(entry?.company)

  return {
    id: row.id,
    pipeline_entry_id: row.pipeline_entry_id,
    created_at: row.created_at,
    deal_state: (row.deal_state ?? 'active') as DealState,
    entry: {
      title: entry?.title ?? null,
      submitter_name: entry?.submitter_name ?? null,
      submitter_email: entry?.submitter_email ?? null,
      submitted_at: entry?.submitted_at ?? row.created_at,
      pipeline_id: entry?.pipeline_id ?? '',
      company_id: entry?.company_id ?? null,
      company: company ? { id: company.id, name: company.name } : null,
      assignees: (entry?.assignees ?? []).map((a) => {
        const user = first(a.user)
        return { user_id: a.user_id, name: user?.name ?? 'Unknown' }
      }),
      sourced_via_partner: fp ? { id: fp.id, name: fp.name } : null,
    },
    categories: (row.categories ?? []).map((c): ActiveDealCategoryData | null => {
      const category = first(c.category)
      if (!category) return null
      const fields = sortFields(category.fields)
      const catFieldIds = new Set(fields.map((f) => f.id))
      return {
        category: {
          ...category,
          fields,
        },
        field_values: allFieldValues.filter((fv) => catFieldIds.has(fv.field_id)),
      }
    }).filter((c): c is ActiveDealCategoryData => c !== null),
  }
}

export const fetchActiveDeals = cache(async (): Promise<ActiveDeal[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deals')
    .select(ACTIVE_DEAL_SELECT)
    .order('created_at', { ascending: false })
  if (!data) return []
  return (data as unknown as ActiveDealRow[]).map(shapeActiveDealRow)
})

// Single deal for its dedicated page. RLS scopes to the caller's org; returns null if not found/permitted.
export const fetchActiveDeal = cache(async (id: string): Promise<ActiveDeal | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deals')
    .select(ACTIVE_DEAL_SELECT)
    .eq('id', id)
    .maybeSingle()
  return data ? shapeActiveDealRow(data as unknown as ActiveDealRow) : null
})

// Just enough to render a back-link/title — for pages (like the Investors sub-page) that
// don't need the deal's full category/field/assignee tree that fetchActiveDeal pulls in.
export const fetchActiveDealSummary = cache(async (id: string): Promise<{ id: string; title: string | null } | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deals')
    .select('id, entry:pipeline_entries(title)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const entry = first((data as { entry: unknown }).entry) as { title: string | null } | null
  return { id: data.id as string, title: entry?.title ?? null }
})

// Lightweight investor count + committed total for the deal page's summary card
// (the full breakdown lives on the dedicated /investors sub-page).
export const fetchActiveDealInvestorSummary = cache(async (activeDealId: string): Promise<{ count: number; totalCommitted: number }> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deal_investors')
    .select('investment_amount')
    .eq('active_deal_id', activeDealId)
  const rows = (data ?? []) as Array<{ investment_amount: number | null }>
  return {
    count: rows.length,
    totalCommitted: rows.reduce((sum, r) => sum + (r.investment_amount ?? 0), 0),
  }
})
