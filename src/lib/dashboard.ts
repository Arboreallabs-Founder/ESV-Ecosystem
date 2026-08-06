import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Everything the Dashboard's overview panels need.
 *
 * Unlike the Deal Desk, this page *does* have real dated work to show — tasks carry due dates and
 * events carry event dates — so "what's coming up" is genuine here rather than a stand-in.
 */

export type DashboardDealRow = {
  id: string
  name: string
  pipelineName: string | null
  stage: string | null
  state: string
  owners: Array<{ name: string; photo_url: string | null }>
  createdAt: string
}

export type UpcomingItem = {
  id: string
  kind: 'task' | 'event'
  title: string
  context: string | null
  date: string
  priority?: string | null
}

export type DashboardOverview = {
  trend: Array<{ date: string; added: number; cumulative: number }>
  byStage: Array<{ label: string; count: number }>
  upcoming: UpcomingItem[]
  deals: DashboardDealRow[]
  submissionsThisMonth: number
  submissionsLastMonth: number
  /** False when a read failed, so the UI can say "unavailable" instead of a confident zero. */
  ok: boolean
}

const TREND_DAYS = 30

function istDay(iso: string): string {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    .toISOString()
    .slice(0, 10)
}

export const fetchDashboardOverview = cache(async (): Promise<DashboardOverview> => {
  const supabase = await createClient()
  const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const today = nowIst.toISOString().slice(0, 10)

  const [entriesRes, dealsRes, tasksRes, eventsRes] = await Promise.all([
    supabase
      .from('pipeline_entries')
      .select('id, submitted_at, stage:pipeline_stages(name, position)')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('active_deals')
      .select('id, deal_state, created_at, entry:pipeline_entries(title, pipeline:pipelines(name), stage:pipeline_stages(name), company:companies(name), assignees:pipeline_entry_assignees(user:users(name, photo_url)))')
      .neq('deal_state', 'archived')
      .order('created_at', { ascending: false }),
    // Only what is still ahead — a dashboard panel called "coming up" must not list last week.
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, assignee:users!assignee_id(name)')
      .neq('status', 'Done')
      .not('due_date', 'is', null)
      .gte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('bulletin_posts')
      .select('id, title, event_date, location')
      .eq('post_type', 'event')
      .not('event_date', 'is', null)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(8),
  ])

  const firstError = entriesRes.error ?? dealsRes.error ?? tasksRes.error ?? eventsRes.error
  if (firstError) console.error('[dashboard] overview read failed:', firstError.message)

  const entries = (entriesRes.data ?? []) as any[]
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

  // ── Stage mix. Stage names repeat across pipelines by design (every pipeline has a Lead
  //    stage), so they are grouped by name and ordered by their position in the flow — ordering by
  //    size would throw away the one thing a funnel's sequence tells you.
  const stageCount = new Map<string, { count: number; position: number }>()
  for (const e of entries) {
    const st = one<{ name: string; position: number }>(e.stage)
    const label = st?.name ?? 'No stage'
    const cur = stageCount.get(label)
    if (cur) cur.count++
    else stageCount.set(label, { count: 1, position: st?.position ?? 999 })
  }
  const byStage = [...stageCount.entries()]
    .sort((a, b) => a[1].position - b[1].position || a[0].localeCompare(b[0]))
    .map(([label, v]) => ({ label, count: v.count }))

  // ── Submissions trend
  const addedByDay = new Map<string, number>()
  for (const e of entries) {
    const d = istDay(e.submitted_at)
    addedByDay.set(d, (addedByDay.get(d) ?? 0) + 1)
  }
  const start = new Date(nowIst)
  start.setDate(start.getDate() - (TREND_DAYS - 1))
  const startKey = start.toISOString().slice(0, 10)
  let cumulative = entries.filter((e) => istDay(e.submitted_at) < startKey).length
  const trend: DashboardOverview['trend'] = []
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const added = addedByDay.get(key) ?? 0
    cumulative += added
    trend.push({ date: key, added, cumulative })
  }

  const thisMonth = today.slice(0, 7)
  const lm = new Date(nowIst.getFullYear(), nowIst.getMonth() - 1, 1)
  const lastMonth = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`
  const monthOf = (iso: string) => istDay(iso).slice(0, 7)

  // ── Deals table
  const deals: DashboardDealRow[] = ((dealsRes.data ?? []) as any[]).map((d) => {
    const entry = one<any>(d.entry)
    const company = one<{ name: string }>(entry?.company)
    return {
      id: d.id,
      name: company?.name ?? entry?.title ?? 'Untitled deal',
      pipelineName: one<{ name: string }>(entry?.pipeline)?.name ?? null,
      stage: one<{ name: string }>(entry?.stage)?.name ?? null,
      state: d.deal_state,
      owners: (entry?.assignees ?? [])
        .map((a: any) => one<{ name: string; photo_url: string | null }>(a.user))
        .filter(Boolean),
      createdAt: d.created_at,
    }
  })

  // ── What's coming up: real dates only, tasks and events interleaved by when they happen.
  const upcoming: UpcomingItem[] = [
    ...((tasksRes.data ?? []) as any[]).map((t) => ({
      id: `task-${t.id}`,
      kind: 'task' as const,
      title: t.title,
      context: one<{ name: string }>(t.assignee)?.name ?? null,
      date: t.due_date,
      priority: t.priority,
    })),
    ...((eventsRes.data ?? []) as any[]).map((e) => ({
      id: `event-${e.id}`,
      kind: 'event' as const,
      title: e.title,
      context: e.location ?? null,
      date: e.event_date,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  return {
    trend,
    byStage,
    upcoming,
    deals,
    submissionsThisMonth: entries.filter((e) => monthOf(e.submitted_at) === thisMonth).length,
    submissionsLastMonth: entries.filter((e) => monthOf(e.submitted_at) === lastMonth).length,
    ok: !firstError,
  }
})
