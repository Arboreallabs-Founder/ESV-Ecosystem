import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DayPlan } from './types'

/* Day plans are read through RLS: your own always, everyone's in the org if you are a founder or
   admin (see 20261002000000). Neither fetch filters by user — the policy decides, which keeps the
   permission in one place rather than two that can disagree. */

/** The caller's own recent plans, newest first — the strip on the to-do page. */
export const fetchMyDayPlans = cache(async (userId: string, limit = 14): Promise<DayPlan[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .order('plan_date', { ascending: false })
    .order('kind', { ascending: true })
    .limit(limit)
  return (data ?? []) as DayPlan[]
})

/**
 * Every plan in a date window, for the Weekly Update.
 *
 * Returns only the caller's own rows for anyone who is not a founder/admin — not by filtering
 * here, but because RLS returns nothing else. The Weekly Update already works this way for tasks
 * and week to-dos.
 */
export const fetchDayPlansBetween = cache(async (start: string, end: string): Promise<DayPlan[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('day_plans')
    .select('*, user:user_id(id, name, photo_url)')
    .gte('plan_date', start)
    .lte('plan_date', end)
    .order('plan_date', { ascending: true })
  return (data ?? []) as unknown as DayPlan[]
})
