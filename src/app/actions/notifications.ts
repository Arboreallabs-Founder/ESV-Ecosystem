'use server'

import { requireAuth } from '@/lib/guards'
import { fetchMyNotifications } from '@/lib/notifications'
import type { AppNotification } from '@/lib/notifications'

// requireAuth rather than requireRole: escalation recipients can be franchise_partners, so every
// authenticated role has a bell. RLS scopes each of these to the caller's own rows regardless.

/** The bell's list, loaded when it is opened. */
export async function getMyNotifications(): Promise<AppNotification[]> {
  await requireAuth()
  return fetchMyNotifications()
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const { supabase } = await requireAuth()
  if (ids.length === 0) return
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
  if (error) console.error('[notifications] could not mark read:', error)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { supabase } = await requireAuth()
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) console.error('[notifications] could not mark all read:', error)
}
