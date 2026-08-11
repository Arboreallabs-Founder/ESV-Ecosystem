import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AutomaticTask } from '@/lib/automatic-tasks-shared'

export type { AutomaticTask } from '@/lib/automatic-tasks-shared'

/**
 * Automatic Tasks — work that falls out of a fund's status rather than being typed by someone.
 *
 * Generated on read, like ghosting, because this app has no scheduler. The rules are pure functions
 * of the fundraise entries, so recomputing is cheap and cannot drift; a cron would be a second
 * source of truth that is wrong between runs.
 *
 * Nobody owns one until it has sat unclaimed for a week, at which point it becomes the deal
 * assignee's — an automatic task nobody ever sees on their own board is one nobody does.
 */

/**
 * Bring the automatic tasks up to date, then read them.
 *
 * The write happens first and deliberately: reading a stale list is how someone concludes the
 * feature does not work. It is one statement and it is idempotent.
 */
export const fetchAutomaticTasks = cache(async (): Promise<AutomaticTask[]> => {
  const supabase = await createClient()

  const { error: genError } = await supabase.rpc('generate_fundraise_tasks')
  if (genError) {
    // The function arrives with 20260915; until then the page shows nothing rather than failing.
    console.error('[automatic-tasks] generation failed:', genError.message)
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, due_date, auto_rule, fundraise_entry_id,
      assignee_id, escalated_at, created_at, completed_at,
      assignee:users!assignee_id(name, photo_url),
      entry:fundraise_entries!fundraise_entry_id(
        id, status,
        investor:investors!investor_id(id, name),
        list:fundraise_lists!list_id(active_deal_id)
      ),
      comments:task_comments(id)
    `)
    .eq('source', 'automatic')
    .neq('status', 'Done')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[automatic-tasks] read failed:', error.message)
    return []
  }

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((t: any) => {
    const entry = one(t.entry)
    return {
      ...t,
      assignee: one(t.assignee),
      entry: entry
        ? { ...entry, investor: one(entry.investor), list: one(entry.list) }
        : null,
      comment_count: (t.comments ?? []).length,
    }
  }) as AutomaticTask[]
})

/** The automatic tasks on one mandate, for the fundraise page. */
export const fetchAutomaticTasksForDeal = cache(async (activeDealId: string): Promise<AutomaticTask[]> => {
  const all = await fetchAutomaticTasks()
  return all.filter((t) => t.entry?.list?.active_deal_id === activeDealId)
})
