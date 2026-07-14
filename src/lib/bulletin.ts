import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BulletinPost } from './types'

export const fetchBulletinPosts = cache(async (): Promise<BulletinPost[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bulletin_posts')
    .select('*, created_by_user:created_by(name)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as BulletinPost[]
})
