'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { BulletinPostType } from '@/lib/types'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

export type BulletinPostInput = {
  post_type: BulletinPostType
  title: string
  body?: string | null
  event_date?: string | null
  event_time?: string | null
  location?: string | null
  pinned?: boolean
}

export async function createBulletinPost(input: BulletinPostInput): Promise<string> {
  const { supabase, userId, orgId } = await requireAdmin()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')

  const { data, error } = await supabase
    .from('bulletin_posts')
    .insert({
      org_id: orgId,
      created_by: userId,
      post_type: input.post_type,
      title,
      body: input.body?.trim() || null,
      event_date: input.post_type === 'event' ? (input.event_date || null) : null,
      event_time: input.post_type === 'event' ? (input.event_time || null) : null,
      location: input.post_type === 'event' ? (input.location?.trim() || null) : null,
      pinned: input.pinned ?? false,
    })
    .select('id')
    .single()
  if (error) throw error
  revalidatePath('/bulletin')
  return data.id as string
}

export async function updateBulletinPost(id: string, input: BulletinPostInput): Promise<void> {
  const { supabase } = await requireAdmin()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')

  const { error } = await supabase
    .from('bulletin_posts')
    .update({
      post_type: input.post_type,
      title,
      body: input.body?.trim() || null,
      event_date: input.post_type === 'event' ? (input.event_date || null) : null,
      event_time: input.post_type === 'event' ? (input.event_time || null) : null,
      location: input.post_type === 'event' ? (input.location?.trim() || null) : null,
      pinned: input.pinned ?? false,
    })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/bulletin')
}

export async function deleteBulletinPost(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/bulletin')
}

export async function toggleBulletinPin(id: string, pinned: boolean): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').update({ pinned }).eq('id', id)
  if (error) throw error
  revalidatePath('/bulletin')
}
