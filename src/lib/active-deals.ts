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
      entry:pipeline_entries(title, submitter_name, submitter_email, submitted_at, pipeline_id),
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
      entry: Array.isArray(row.entry) ? row.entry[0] : row.entry,
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
