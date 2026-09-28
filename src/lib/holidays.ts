import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Holiday } from './types'

/** The full calendar, newest year first — backs the Holidays tab in HR Zone. */
export const fetchHolidays = cache(async (): Promise<Holiday[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('holidays')
    .select('*')
    .order('holiday_date', { ascending: true })
  return (data ?? []) as Holiday[]
})

/**
 * Just the dates, as a Set, for the working-day arithmetic in lib/working-days.ts.
 *
 * Unbounded on purpose: a leave request can be filed against any year, and the whole table is a
 * few dozen rows per year. Narrowing it to a date window would mean threading that window through
 * every caller to save nothing.
 */
export const fetchHolidayDates = cache(async (): Promise<ReadonlySet<string>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('holidays').select('holiday_date')
  return new Set((data ?? []).map((h: { holiday_date: string }) => h.holiday_date))
})
