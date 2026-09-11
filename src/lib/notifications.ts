import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type NotificationKind =
  | 'task_assigned' | 'task_reassigned' | 'task_comment'
  | 'leave_submitted' | 'leave_decided'
  | 'expense_submitted' | 'expense_decided'
  | 'kudos_received' | 'escalation_raised' | 'approval_recorded'
  | 'bulletin_posted' | 'event_posted'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
  actor?: { name: string | null; photo_url: string | null } | null
}

/** Everyone who holds one of these roles in this org. */
export async function usersWithRoles(
  supabase: SupabaseClient,
  orgId: string,
  roles: string[],
): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .in('role', roles)
  return ((data ?? []) as Array<{ id: string }>).map((u) => u.id)
}

/**
 * Tell people something happened. Every notification in the app goes through here.
 *
 * Never throws, and never surfaces a failure to the caller: a leave approval that worked must not
 * report itself as failed because the notification did not. Note that supabase-js returns errors
 * rather than throwing them, so the insert's error field is checked explicitly — a bare try/catch
 * would reproduce exactly the silent failure that notify-founders.ts had.
 */
export async function notify(
  supabase: SupabaseClient,
  params: {
    orgId: string | null
    userIds: Array<string | null | undefined>
    actorId: string | null
    kind: NotificationKind
    title: string
    body?: string | null
    link?: string | null
  },
): Promise<void> {
  try {
    if (!params.orgId) return

    // Nobody is told about their own action — assigning yourself a task should not badge your own
    // bell. Deduped because "the approvers" and "the founders" overlap.
    const recipients = [...new Set(params.userIds.filter(Boolean) as string[])]
      .filter((id) => id !== params.actorId)
    if (recipients.length === 0) return

    const { error } = await supabase.from('notifications').insert(
      recipients.map((user_id) => ({
        org_id: params.orgId,
        user_id,
        actor_id: params.actorId,
        kind: params.kind,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      })),
    )
    if (error) {
      console.error('[notify] could not write notifications:', error)
      return
    }

    // TODO(push): when the iOS/Android clients exist, this is the only place that changes. Look up
    // push_tokens for `recipients`, hand the same title/body/link to FCM, and clear any token the
    // send rejects. Every caller in the app already routes through this function, so none of them
    // need to be touched again to gain push.
  } catch (err) {
    console.error('[notify] unexpected failure:', err)
  }
}

/**
 * The only notification question the app shell asks on every navigation. Answered off the partial
 * index, so it costs nothing as the read pile grows.
 */
export const fetchUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
})

/** The list itself, fetched when the bell is opened rather than on every page load. */
export const fetchMyNotifications = cache(async (limit = 30): Promise<AppNotification[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at, actor:actor_id(name, photo_url)')
    .order('created_at', { ascending: false })
    .limit(limit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((n) => ({
    ...n,
    actor: Array.isArray(n.actor) ? (n.actor[0] ?? null) : (n.actor ?? null),
  })) as AppNotification[]
})
