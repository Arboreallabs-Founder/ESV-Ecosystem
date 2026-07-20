import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BulletinEventKpiRow, BulletinPost } from './types'

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

const POST_SELECT = `
  *,
  created_by_user:created_by(name),
  attendees:bulletin_event_attendees(user_id, user:users(name)),
  media:bulletin_event_media(id, post_id, label, url, created_at)
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapePost(row: any): BulletinPost {
  return {
    ...row,
    completed: row.completed ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attendees: (row.attendees ?? []).map((a: any) => ({ user_id: a.user_id, name: one(a.user)?.name ?? 'Unknown' })),
    media: row.media ?? [],
  }
}

export const fetchBulletinPosts = cache(async (): Promise<BulletinPost[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bulletin_posts')
    .select(POST_SELECT)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(shapePost)
})

// Every event post (past + upcoming), attendee roster, and media count — for the Bulletin
// KPI page's "who attended what" summary.
export const fetchBulletinEventKpi = cache(async (): Promise<BulletinEventKpiRow[]> => {
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
