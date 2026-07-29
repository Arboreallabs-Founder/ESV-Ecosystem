import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BulletinEventKpiRow, BulletinPost, EventEditLogEntry } from './types'

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

const EVENT_SELECT = `
  *,
  created_by_user:created_by(name, photo_url),
  attendees:bulletin_event_attendees(user_id, user:users(name)),
  media:bulletin_event_media(id, post_id, label, url, created_at)
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeEvent(row: any): BulletinPost {
  return {
    ...row,
    completed: row.completed ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attendees: (row.attendees ?? []).map((a: any) => ({ user_id: a.user_id, name: one(a.user)?.name ?? 'Unknown' })),
    media: row.media ?? [],
  }
}

// Events used to live inside Bulletin Board (post_type = 'event' on bulletin_posts); they
// now have their own section, but still share the same underlying table/RLS.
export const fetchEvents = cache(async (): Promise<BulletinPost[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bulletin_posts')
    .select(EVENT_SELECT)
    .eq('post_type', 'event')
    .order('pinned', { ascending: false })
    .order('event_date', { ascending: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(shapeEvent)
})

// Every event (past + upcoming), attendee roster, and media count — for the Event KPI page's
// "who attended what" summary.
export const fetchEventKpi = cache(async (): Promise<BulletinEventKpiRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bulletin_posts')
    .select(`
      id, title, event_date, event_time, location, completed,
      attendees:bulletin_event_attendees(user_id, user:users(name)),
      media:bulletin_event_media(id)
    `)
    .eq('post_type', 'event')
    .order('event_date', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    event_date: row.event_date,
    event_time: row.event_time,
    location: row.location,
    completed: row.completed ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attendees: (row.attendees ?? []).map((a: any) => ({ user_id: a.user_id, name: one(a.user)?.name ?? 'Unknown' })),
    media_count: (row.media ?? []).length,
  }))
})

// Founder/admin-only audit trail of event edits (RLS restricts the SELECT to those roles).
export const fetchEventEditLog = cache(async (): Promise<EventEditLogEntry[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_edit_log')
    .select('id, event_id, event_title, edited_by_name, action, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as EventEditLogEntry[]
})
