import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { RecurringTask, RecurringTaskStatus } from './types'
import { computeRecurringStatus } from './recurrence'

export const fetchRecurringTasks = cache(async (): Promise<Array<RecurringTask & { status: RecurringTaskStatus }>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('recurring_tasks')
    .select('*, assignee:assignee_id(name), completions:recurring_task_completions(completed_at, completed_by_user:completed_by(name))')
    .order('next_due_date', { ascending: true })

  const rows = (data ?? []) as unknown as Array<RecurringTask & { completions: Array<{ completed_at: string; completed_by_user: { name: string } | null }> }>
  return rows.map((r) => {
    const last = [...(r.completions ?? [])].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]
    const { completions: _completions, ...rest } = r
    void _completions
    return {
      ...rest,
      last_completion: last ? { completed_at: last.completed_at, completed_by_name: last.completed_by_user?.name ?? null } : null,
      status: computeRecurringStatus(r.next_due_date, r.lead_days),
    }
  })
})
