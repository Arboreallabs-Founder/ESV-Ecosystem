'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// Any internal user (including general) may RSVP themselves — never on someone else's behalf.
async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general'])
}

function revalidateEvents() {
  revalidatePath('/events')
  revalidatePath('/events/past')
  revalidatePath('/events/kpi')
}

export type EventInput = {
  title: string
  body?: string | null
  event_date: string
  event_time?: string | null
  location?: string | null
  pinned?: boolean
  media_url?: string | null
  scanned_cards_url?: string | null
}

export async function createEvent(input: EventInput): Promise<string> {
  const { supabase, userId, orgId } = await requireAdmin()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (!input.event_date) throw new Error('Event date is required.')

  const { data, error } = await supabase
    .from('bulletin_posts')
    .insert({
      org_id: orgId,
      created_by: userId,
      post_type: 'event',
      title,
      body: input.body?.trim() || null,
      event_date: input.event_date,
      event_time: input.event_time || null,
      location: input.location?.trim() || null,
      pinned: input.pinned ?? false,
      media_url: input.media_url?.trim() || null,
      scanned_cards_url: input.scanned_cards_url?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw error
  revalidateEvents()
  return data.id as string
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { supabase } = await requireAdmin()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (!input.event_date) throw new Error('Event date is required.')

  const { error } = await supabase
    .from('bulletin_posts')
    .update({
      title,
      body: input.body?.trim() || null,
      event_date: input.event_date,
      event_time: input.event_time || null,
      location: input.location?.trim() || null,
      pinned: input.pinned ?? false,
      media_url: input.media_url?.trim() || null,
      scanned_cards_url: input.scanned_cards_url?.trim() || null,
    })
    .eq('id', id)
  if (error) throw error
  revalidateEvents()
}

export async function deleteEvent(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').delete().eq('id', id)
  if (error) throw error
  revalidateEvents()
}

export async function toggleEventPin(id: string, pinned: boolean): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').update({ pinned }).eq('id', id)
  if (error) throw error
  revalidateEvents()
}

export async function toggleEventCompleted(id: string, completed: boolean): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').update({ completed }).eq('id', id)
  if (error) throw error
  revalidateEvents()
}

// ── Attendance ("Going" / who attended) ─────────────────────────────────────

export async function toggleEventAttendance(postId: string, going: boolean): Promise<void> {
  const { supabase, userId, orgId } = await requireInternal()
  if (going) {
    const { error } = await supabase
      .from('bulletin_event_attendees')
      .upsert({ post_id: postId, org_id: orgId, user_id: userId }, { onConflict: 'post_id,user_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('bulletin_event_attendees')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
  }
  revalidateEvents()
}

// ── Supporting media links (freeform, admin-managed — kept alongside the two dedicated
// Google/scanned-cards fields for anything else worth attaching) ───────────────────────

export async function addEventMediaLink(postId: string, label: string | null, url: string): Promise<string> {
  const { supabase, userId, orgId } = await requireAdmin()
  const trimmedUrl = url.trim()
  if (!trimmedUrl) throw new Error('A link URL is required.')
  const { data, error } = await supabase
    .from('bulletin_event_media')
    .insert({ post_id: postId, org_id: orgId, label: label?.trim() || null, url: trimmedUrl, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  revalidateEvents()
  return data.id as string
}

export async function deleteEventMediaLink(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_event_media').delete().eq('id', id)
  if (error) throw error
  revalidateEvents()
}
