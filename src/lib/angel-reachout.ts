import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AngelReachoutList } from '@/lib/types'

/**
 * Angel Reachout — the syndicate side.
 *
 * Angels do not run an institutional process, so this is not a status funnel. What matters is who
 * reached out, how, when, and what came back (§16). One list is one collaborative task rather than
 * a task per investor: forty angels would otherwise be forty cards nobody can see the shape of.
 */
export const fetchAngelLists = cache(async (activeDealId: string): Promise<AngelReachoutList[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('angel_reachout_lists')
    .select(`
      id, active_deal_id, method, method_other, title, task_id, created_by, created_at,
      created_by_user:users!created_by(name),
      members:angel_reachout_members(
        id, list_id, investor_id, included, done, done_by, done_at, response, responded_at,
        investor:investors!investor_id(id, name, service_type),
        done_by_user:users!done_by(name, photo_url)
      )
    `)
    .eq('active_deal_id', activeDealId)
    .order('created_at', { ascending: false })

  if (error) {
    // The tables arrive with 20260917; until then the page offers to start one rather than failing.
    console.error('[angel-reachout] read failed:', error.message)
    return []
  }

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((l: any) => ({
    ...l,
    created_by_user: one(l.created_by_user),
    members: (l.members ?? [])
      .map((m: any) => ({
        ...m,
        investor: one(m.investor),
        done_by_user: one(m.done_by_user),
      }))
      // By name: this is a list you work down, not a feed.
      .sort((a: any, b: any) => (a.investor?.name ?? '').localeCompare(b.investor?.name ?? '')),
  })) as AngelReachoutList[]
})

/**
 * Whether this deal is a syndicate.
 *
 * Angel Reachout is syndicate-only (§13). Checked against the deal's categories rather than a flag,
 * because that is where the answer already lives and a second copy would drift.
 */
export const isSyndicateDeal = cache(async (activeDealId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deal_categories')
    .select('category:deal_categories(name)')
    .eq('active_deal_id', activeDealId)

  return (data ?? []).some((row: any) => {
    const c = Array.isArray(row.category) ? row.category[0] : row.category
    return (c?.name ?? '').toLowerCase().includes('syndicate')
  })
})
