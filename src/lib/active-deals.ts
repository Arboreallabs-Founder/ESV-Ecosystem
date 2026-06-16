import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ActiveDeal, DealCategory } from '@/lib/types'

export const fetchCategories = cache(async (): Promise<DealCategory[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_categories')
    .select('*, fields:deal_category_fields(*)')
    .order('created_at', { ascending: true })
  if (!data) return []
  return data.map((c: any) => ({
    ...c,
    fields: (c.fields ?? []).sort((a: any, b: any) => a.position - b.position),
  }))
})

export const fetchActiveDeals = cache(async (): Promise<ActiveDeal[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deals')
    .select(`
      id,
      pipeline_entry_id,
      created_at,
      entry:pipeline_entries(title, submitter_name, submitter_email, submitted_at, pipeline_id, assignees:pipeline_entry_assignees(user_id, user:users(name)), form_link:form_links!form_link_id(creator:users!created_by(franchise_partner:franchise_partners!franchise_partner_id(id, name)))),
      categories:active_deal_categories(
        category:deal_categories(
          id, name, description, color, created_at,
          fields:deal_category_fields(*)
        )
      ),
      field_values:active_deal_field_values(field_id, value)
    `)
    .order('created_at', { ascending: false })

  if (!data) return []

  return data.map((row: any) => {
    const allFieldValues: Array<{ field_id: string; value: string | null }> = row.field_values ?? []
    return {
      id: row.id,
      pipeline_entry_id: row.pipeline_entry_id,
      created_at: row.created_at,
      entry: (() => {
        const e = Array.isArray(row.entry) ? row.entry[0] : row.entry
        if (!e) return e
        const formLink = Array.isArray(e.form_link) ? e.form_link[0] : e.form_link
        const creator = Array.isArray(formLink?.creator) ? formLink?.creator[0] : formLink?.creator
        const fp = Array.isArray(creator?.franchise_partner) ? creator?.franchise_partner[0] : creator?.franchise_partner
        return {
          ...e,
          assignees: (e.assignees ?? []).map((a: any) => ({ user_id: a.user_id, name: a.user?.name ?? 'Unknown' })),
          sourced_via_partner: fp ? { id: fp.id, name: fp.name } : null,
        }
      })(),
      categories: (row.categories ?? []).map((c: any) => {
        const catFieldIds = new Set((c.category?.fields ?? []).map((f: any) => f.id))
        return {
          category: {
            ...c.category,
            fields: (c.category?.fields ?? []).sort((a: any, b: any) => a.position - b.position),
          },
          field_values: allFieldValues.filter((fv) => catFieldIds.has(fv.field_id)),
        }
      }),
    }
  })
})
