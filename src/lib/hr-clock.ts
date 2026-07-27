import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { HrClockSettings, HrBirthday } from './types'

const DEFAULT_SETTINGS: Omit<HrClockSettings, 'id' | 'updated_at'> = {
  clock_in_start: '09:30:00',
  clock_in_end: '10:30:00',
  clock_out_start: '18:30:00',
  clock_out_end: '19:30:00',
}

// Falls back to the hardcoded defaults if the org's row hasn't been seeded yet (e.g. a
// brand-new org created after this migration ran) — the UI never needs to handle "no data".
export const fetchClockSettings = cache(async (): Promise<HrClockSettings> => {
  const supabase = await createClient()
  const { data } = await supabase.from('hr_clock_settings').select('*').maybeSingle()
  if (!data) return { id: '', updated_at: '', ...DEFAULT_SETTINGS }
  return data as HrClockSettings
})

// "Today" is computed in India time, not server/UTC time — Vercel's functions run in UTC,
// so a naive server-side "today" would be wrong for ~5.5 hours around UTC midnight.
function todayIstMonthDay(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${month}-${day}`
}

export const fetchTodaysBirthdays = cache(async (): Promise<HrBirthday[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('hr_birthdays').select('*').order('name', { ascending: true })
  const monthDay = todayIstMonthDay()
  // birth_date is 'YYYY-MM-DD' — slice, don't parse as a Date, to avoid any timezone ambiguity.
  return ((data ?? []) as HrBirthday[]).filter((b) => b.birth_date.slice(5, 10) === monthDay)
})

export const fetchAllBirthdays = cache(async (): Promise<HrBirthday[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('hr_birthdays').select('*').order('name', { ascending: true })
  return (data ?? []) as HrBirthday[]
})
