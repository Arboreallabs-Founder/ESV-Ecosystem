'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { notify, usersWithRoles } from '@/lib/notifications'

// Everyone with a bell. Partners are excluded: the bulletin board is not theirs to read.
const INTERNAL_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// HR can create/edit announcements too (not delete/pin) — mirrors hr-zone.ts/events.ts.
async function requireEditor() {
  return requireRole(['founder', 'admin', 'hr'])
}

// Bulletin Board is announcements-only now — events moved to @/app/actions/events.

export type BulletinPostInput = {
  title: string
  body?: string | null
  pinned?: boolean
  /** Opt-in, off by default: badge every internal user's bell. Routine notices stay quiet. */
  notify?: boolean
}

export async function createBulletinPost(input: BulletinPostInput): Promise<string> {
  const { supabase, userId, orgId } = await requireEditor()
  const title = input.title.trim()
  if (!title) throw new UserFacingError('Title is required.')

  const { data, error } = await supabase
    .from('bulletin_posts')
    .insert({
      org_id: orgId,
      created_by: userId,
      post_type: 'announcement',
      title,
      body: input.body?.trim() || null,
      pinned: input.pinned ?? false,
    })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)

  if (input.notify && orgId) {
    await notify(supabase, {
      orgId,
      userIds: await usersWithRoles(supabase, orgId, INTERNAL_ROLES),
      actorId: userId,
      kind: 'bulletin_posted',
      title,
      body: 'New announcement',
      link: '/bulletin',
    })
  }

  revalidatePath('/bulletin')
  return data.id as string
}

export async function updateBulletinPost(id: string, input: BulletinPostInput): Promise<void> {
  const { supabase } = await requireEditor()
  const title = input.title.trim()
  if (!title) throw new UserFacingError('Title is required.')

  const { error } = await supabase
    .from('bulletin_posts')
    .update({
      title,
      body: input.body?.trim() || null,
      pinned: input.pinned ?? false,
    })
    .eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/bulletin')
}

export async function deleteBulletinPost(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/bulletin')
}

export async function toggleBulletinPin(id: string, pinned: boolean): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('bulletin_posts').update({ pinned }).eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/bulletin')
}
