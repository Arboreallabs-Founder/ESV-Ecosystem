import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BulletinPost } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapePost(row: any): BulletinPost {
  return {
    ...row,
    completed: row.completed ?? false,
    attendees: [],
    media: [],
  }
}

// Bulletin Board is announcements-only now — events moved to their own section (@/lib/events).
export const fetchBulletinPosts = cache(async (): Promise<BulletinPost[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bulletin_posts')
    .select('*, created_by_user:created_by(name)')
    .eq('post_type', 'announcement')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(shapePost)
})
