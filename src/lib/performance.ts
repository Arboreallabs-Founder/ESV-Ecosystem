import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { computeKpis } from '@/lib/task-kpi'
import type {
  PerformanceAdjustment, PerformanceRow, PerformanceWeights, ScorePeriod, Task,
} from './types'

/* Scoring engine.
   Every signal here is something the app already records. Leave is deliberately absent — see the
   migration comment in 20260815000000_performance_analytics.sql for why. */

const SCORED_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']

const DEFAULT_WEIGHTS: Omit<PerformanceWeights, 'id' | 'updated_at'> = {
  kudos_received: 5,
  task_on_time: 2,
  task_overdue: -3,
  task_pushed: -1,
  recurring_completed: 1,
  event_attended: 1,
}

/** Inclusive lower bound for the period, or null for all-time. */
export function periodStart(period: ScorePeriod): Date | null {
  const now = new Date()
  switch (period) {
    case '30d': return new Date(now.getTime() - 30 * 86_400_000)
    case '90d': return new Date(now.getTime() - 90 * 86_400_000)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'year': return new Date(now.getFullYear(), 0, 1)
    case 'all': return null
  }
}

export const fetchPerformanceWeights = cache(async (): Promise<PerformanceWeights> => {
  const supabase = await createClient()
  const { data } = await supabase.from('performance_weights').select('*').maybeSingle()
  if (!data) return { id: '', updated_at: '', ...DEFAULT_WEIGHTS }
  return data as PerformanceWeights
})

export const fetchAdjustments = cache(async (period: ScorePeriod): Promise<PerformanceAdjustment[]> => {
  const supabase = await createClient()
  const start = periodStart(period)
  let q = supabase
    .from('performance_adjustments')
    .select('*, user:user_id(name), created_by_user:created_by(name)')
    .order('occurred_on', { ascending: false })
  if (start) q = q.gte('occurred_on', start.toISOString().slice(0, 10))
  const { data } = await q
  return (data ?? []) as unknown as PerformanceAdjustment[]
})

/**
 * Per-person scored signals for the period.
 *
 * RLS scopes every underlying query, so a non-privileged caller simply gets back only the rows
 * they're allowed to see — the caller decides what to render, the database decides what's visible.
 */
export const fetchPerformanceRows = cache(async (period: ScorePeriod): Promise<PerformanceRow[]> => {
  const supabase = await createClient()
  const start = periodStart(period)
  const startIso = start ? start.toISOString() : null
  const startDate = start ? start.toISOString().slice(0, 10) : null

  const [weights, usersRes, kudosRes, tasksRes, recurringRes, eventsRes, adjustmentsRes] = await Promise.all([
    fetchPerformanceWeights(),
    supabase.from('users').select('id, name, role').in('role', SCORED_ROLES).order('name'),
    (() => {
      let q = supabase.from('kudos').select('recipient_id, category, created_at')
      if (startIso) q = q.gte('created_at', startIso)
      return q
    })(),
    (() => {
      let q = supabase.from('tasks').select('*')
      // Filter on created_at: a task's punctuality belongs to the period it was raised in.
      if (startIso) q = q.gte('created_at', startIso)
      return q
    })(),
    (() => {
      let q = supabase.from('recurring_task_completions').select('completed_by, occurrence_date')
      if (startDate) q = q.gte('occurrence_date', startDate)
      return q
    })(),
    (() => {
      let q = supabase.from('bulletin_event_attendees').select('user_id, created_at')
      if (startIso) q = q.gte('created_at', startIso)
      return q
    })(),
    (() => {
      let q = supabase.from('performance_adjustments').select('user_id, points')
      if (startDate) q = q.gte('occurred_on', startDate)
      return q
    })(),
  ])

  const users = (usersRes.data ?? []) as Array<{ id: string; name: string | null; role: string }>
  const tasks = (tasksRes.data ?? []) as unknown as Task[]

  // Bucket every signal by user id up-front so the per-user loop stays O(1) per lookup.
  const kudosByUser = new Map<string, { total: number; byCategory: Record<string, number> }>()
  for (const k of kudosRes.data ?? []) {
    const row = kudosByUser.get(k.recipient_id) ?? { total: 0, byCategory: {} }
    row.total++
    const cat = k.category ?? 'Uncategorised'
    row.byCategory[cat] = (row.byCategory[cat] ?? 0) + 1
    kudosByUser.set(k.recipient_id, row)
  }

  const recurringByUser = new Map<string, number>()
  for (const r of recurringRes.data ?? []) {
    if (!r.completed_by) continue
    recurringByUser.set(r.completed_by, (recurringByUser.get(r.completed_by) ?? 0) + 1)
  }

  const eventsByUser = new Map<string, number>()
  for (const e of eventsRes.data ?? []) {
    eventsByUser.set(e.user_id, (eventsByUser.get(e.user_id) ?? 0) + 1)
  }

  const adjByUser = new Map<string, { points: number; count: number }>()
  for (const a of adjustmentsRes.data ?? []) {
    const row = adjByUser.get(a.user_id) ?? { points: 0, count: 0 }
    row.points += Number(a.points)
    row.count++
    adjByUser.set(a.user_id, row)
  }

  return users.map((u) => {
    const kudos = kudosByUser.get(u.id) ?? { total: 0, byCategory: {} }
    const k = computeKpis(tasks.filter((t) => t.assignee_id === u.id))
    const recurring = recurringByUser.get(u.id) ?? 0
    const events = eventsByUser.get(u.id) ?? 0
    const adj = adjByUser.get(u.id) ?? { points: 0, count: 0 }

    const contributions: Record<string, number> = {
      kudos_received: kudos.total * Number(weights.kudos_received),
      task_on_time: k.onTime * Number(weights.task_on_time),
      task_overdue: k.notCompleted * Number(weights.task_overdue),
      task_pushed: k.pushed * Number(weights.task_pushed),
      recurring_completed: recurring * Number(weights.recurring_completed),
      event_attended: events * Number(weights.event_attended),
      adjustments: adj.points,
    }
    const score = Object.values(contributions).reduce((s, n) => s + n, 0)

    return {
      user_id: u.id,
      user_name: u.name ?? 'Unknown',
      role: u.role,
      kudosReceived: kudos.total,
      kudosByCategory: kudos.byCategory,
      tasksTotal: k.total,
      tasksOnTime: k.onTime,
      tasksOverdue: k.notCompleted,
      tasksPushed: k.pushed,
      recurringCompleted: recurring,
      eventsAttended: events,
      adjustmentPoints: adj.points,
      adjustmentCount: adj.count,
      // Rate is null rather than 0 when nothing is done yet — "no data" and "0%" are different
      // claims, and showing 0% for someone with no closed tasks would be a false negative signal.
      onTimeRate: k.done > 0 ? Math.round((k.onTime / k.done) * 100) : null,
      contributions,
      score: Math.round(score * 10) / 10,
    }
  })
})
