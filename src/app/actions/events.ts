'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// HR can create/edit events too (not delete/pin/complete/attendee-manage) — see the
// audit log this writes to. General lost this tier when HR was introduced.
async function requireEditor() {
  return requireRole(['founder', 'admin', 'hr'])
}

// Any internal user may RSVP themselves — never on someone else's behalf.
async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
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

function describeEventChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string {
  const labels: Record<string, string> = {
    event_date: 'Date', event_time: 'Time', location: 'Location',
    media_url: 'Event media', scanned_cards_url: 'Scanned cards', pinned: 'Pinned',
  }
  const lines: string[] = []
  if (before.title !== after.title) lines.push(`Title: ${before.title} → ${after.title}`)
  if (before.body !== after.body) lines.push('Details updated')
  for (const [key, label] of Object.entries(labels)) {
    const a = JSON.stringify(before[key] ?? null)
    const b = JSON.stringify(after[key] ?? null)
    if (a !== b) lines.push(`${label}: ${before[key] ?? '—'} → ${after[key] ?? '—'}`)
  }
  return lines.join('; ')
}

export async function createEvent(input: EventInput): Promise<string> {
  const { supabase, userId, orgId } = await requireEditor()
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

  try {
    const { data: editor } = await supabase.from('users').select('name').eq('id', userId).single()
    await supabase.from('event_edit_log').insert({
      event_id: data.id, org_id: orgId, edited_by: userId, edited_by_name: editor?.name ?? null,
      event_title: title, action: 'created', changes: 'Created',
    })
  } catch { /* non-fatal: don't block the save if the audit log insert fails */ }

  revalidateEvents()
  return data.id as string
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { supabase, userId, orgId } = await requireEditor()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (!input.event_date) throw new Error('Event date is required.')

  const nextFields = {
    title,
    body: input.body?.trim() || null,
    event_date: input.event_date,
    event_time: input.event_time || null,
    location: input.location?.trim() || null,
    pinned: input.pinned ?? false,
    media_url: input.media_url?.trim() || null,
    scanned_cards_url: input.scanned_cards_url?.trim() || null,
  }

  const { data: before } = await supabase
    .from('bulletin_posts')
    .select('title, body, event_date, event_time, location, pinned, media_url, scanned_cards_url')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('bulletin_posts').update(nextFields).eq('id', id)
  if (error) throw error

  try {
    const changes = before ? describeEventChanges(before as unknown as Record<string, unknown>, nextFields) : ''
    if (changes) {
      const { data: editor } = await supabase.from('users').select('name').eq('id', userId).single()
      await supabase.from('event_edit_log').insert({
        event_id: id, org_id: orgId, edited_by: userId, edited_by_name: editor?.name ?? null,
        event_title: title, action: 'updated', changes,
      })
    }
  } catch { /* non-fatal: don't block the save if the audit log insert fails */ }

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

// Admin-only: log attendance on someone else's behalf (backfilling a past event, or
// marking who showed up when they didn't RSVP themselves through the app).
export async function addEventAttendee(postId: string, userId: string): Promise<{ user_id: string; name: string }> {
  const { supabase, orgId } = await requireAdmin()
  const { error } = await supabase
    .from('bulletin_event_attendees')
    .upsert({ post_id: postId, org_id: orgId, user_id: userId }, { onConflict: 'post_id,user_id' })
  if (error) throw error
  const { data: userRow } = await supabase.from('users').select('name').eq('id', userId).single()
  revalidateEvents()
  return { user_id: userId, name: userRow?.name ?? 'Unknown' }
}

export async function removeEventAttendee(postId: string, userId: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('bulletin_event_attendees')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
  if (error) throw error
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
