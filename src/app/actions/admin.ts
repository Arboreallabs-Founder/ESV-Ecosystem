'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { mirrorImage, isAlreadyCached } from '@/lib/image-cache'

async function requireAdminOrFounder() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, callerId: userId, orgId }
}

/**
 * The roles a tenant administrator may hand out. `super_admin` is deliberately absent: it is the
 * platform role that bypasses organisation scoping, and nothing inside a tenant should be able to
 * mint one.
 *
 * The admin screen already offers exactly this set, but a Server Action argument is not a form
 * field — it is an HTTP parameter anyone with a session can craft. The database enforces this too
 * (20260920); this exists so a refusal arrives as a sentence rather than a Postgres error, and so
 * the rule is visible at the place the value enters the system.
 */
const ASSIGNABLE_ROLES = ['founder', 'admin', 'associate', 'franchise_partner', 'general', 'hr'] as const

function assertAssignableRole(role: string): void {
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
    throw new UserFacingError(`"${role}" is not a role you can assign.`)
  }
}

export async function addApprovedUser(email: string, name: string, role: string, password?: string) {
  const { supabase, callerId, orgId } = await requireAdminOrFounder()
  assertAssignableRole(role)
  const normalizedEmail = email.toLowerCase().trim()
  const trimmedName = name.trim()

  const { error } = await supabase.from('approved_emails').insert({
    email: normalizedEmail,
    name: trimmedName,
    role,
    added_by: callerId,
    org_id: orgId,
  })
  if (error) throw dbFailure('save that', error)

  if (password) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: normalizedEmail, password, name: trimmedName, role }),
      },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new UserFacingError(body.error ?? 'Failed to create user account')
    }
  }
  // No revalidatePath here — optimistic update in UsersTable handles the UI.
  // revalidatePath would reset modal state by triggering an RSC refresh.
}

export async function updateApprovedUser(
  email: string,
  name: string,
  role: string,
  userId: string | null,
  designation?: string | null,
) {
  const { supabase } = await requireAdminOrFounder()
  assertAssignableRole(role)
  const trimmedName = name.trim()

  // approved_emails carries only what is needed to let someone in; it has no designation column,
  // which is why a job title can't be set before first login.
  const { error: emailError } = await supabase
    .from('approved_emails')
    .update({ name: trimmedName, role })
    .eq('email', email)
  if (emailError) throw dbFailure('update the approved-emails list', emailError)

  // Also update public.users if they have already logged in
  if (userId) {
    const patch: Record<string, unknown> = { name: trimmedName, role }
    // undefined means "not being edited"; null means "cleared".
    if (designation !== undefined) patch.designation = designation?.trim() || null
    await supabase.from('users').update(patch).eq('id', userId)
  }

  // No revalidatePath — optimistic update + router.refresh() in UsersTable handles the UI.
}

export async function revokeUser(email: string, userId: string | null) {
  const { supabase } = await requireAdminOrFounder()

  // Remove from allowlist first — blocks future logins immediately
  await supabase.from('approved_emails').delete().eq('email', email)

  if (userId) {
    // Look up franchise_partner_id before deleting
    const { data: userRow } = await supabase
      .from('users')
      .select('franchise_partner_id')
      .eq('id', userId)
      .single()

    if (userRow?.franchise_partner_id) {
      await supabase.from('franchise_partners').delete().eq('id', userRow.franchise_partner_id)
    }

    // Delete public.users explicitly first (FK was NO ACTION — now CASCADE, but belt-and-suspenders)
    await supabase.from('users').delete().eq('id', userId)

    // Delete auth.users via edge function (service role required)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId }),
      },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new UserFacingError(body.error ?? 'Failed to delete auth account')
    }
  }

  // No revalidatePath for /admin/users — router.refresh() in UsersTable handles that.
  revalidatePath('/admin/partners')
}

// ── Avatars ─────────────────────────────────────────────────────────────────

/**
 * Set (or clear) a user's avatar from a pasted image URL.
 *
 * The image is mirrored into our own storage rather than the URL being stored as-is — see
 * src/lib/image-cache.ts for why (short version: LinkedIn and friends serve signed URLs that
 * expire, so a stored link works today and 404s later).
 *
 * A mirroring failure throws with a readable message rather than silently falling back to the
 * raw URL: a fallback would reintroduce exactly the rot this exists to prevent, and the admin
 * would have no idea it happened.
 */
export async function setUserPhotoFromUrl(userId: string, sourceUrl: string | null): Promise<string | null> {
  const { supabase } = await requireAdminOrFounder()
  if (!userId) throw new UserFacingError('That person has not signed in yet, so there is no profile to attach a photo to.')

  const raw = sourceUrl?.trim() ?? ''
  if (!raw) {
    const { error } = await supabase.from('users').update({ photo_url: null }).eq('id', userId)
    if (error) throw dbFailure('save that', error)
    revalidatePath('/admin/users')
    return null
  }

  // Already one of ours (e.g. re-saving an unchanged form) — copying it again would only churn.
  const photoUrl = isAlreadyCached(raw)
    ? raw
    : (await mirrorImage(supabase, raw, 'profile-photos', `${userId}/avatar`)).publicUrl

  const { error } = await supabase.from('users').update({ photo_url: photoUrl }).eq('id', userId)
  if (error) throw dbFailure('save that', error)

  revalidatePath('/admin/users')
  revalidatePath('/tasks')
  revalidatePath('/approvals')
  return photoUrl
}
