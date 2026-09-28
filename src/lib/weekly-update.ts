import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PersonalTodo } from './types'

/* Extra inputs for the Weekly Update beyond tasks: each deal's latest update, and the personal
   to-dos people have filed into a work week. Both are read through RLS — leadership sees the
   team's, everyone else sees only their own. */

/** Newest update per active deal, keyed by deal id. */
export const fetchLatestDealUpdates = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deal_updates')
    .select('active_deal_id, body, created_at')
    .order('created_at', { ascending: false })

  const latest: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ active_deal_id: string; body: string }>) {
    // Rows arrive newest-first, so the first sighting of a deal is its latest update.
    if (!(row.active_deal_id in latest)) latest[row.active_deal_id] = row.body
  }
  return latest
})

/**
 * Personal to-dos filed into a work week.
 *
 * Only week-assigned items are readable by leadership (see the RLS policy added in
 * 20260818000000) — an item with no work week stays private to its owner, which is what makes
 * putting it in a week a deliberate act of sharing rather than a leak.
 */
export const fetchWeekTodos = cache(async (): Promise<PersonalTodo[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('personal_todos')
    // Sub-tasks carry no work week of their own — they inherit the parent's. Fetching them
    // alongside is what lets the rollup show "Kyoora 1/2" with the two items under it; without
    // the parent_id arm the parent would render as a bare line with its sub-items missing.
    // RLS still decides what comes back (a lead sees a sub-task only if its parent is shared).
    .select('*')
    .or('work_week_start.not.is.null,parent_id.not.is.null')
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as PersonalTodo[]
})
