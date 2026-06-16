'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdminOrFounder() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, callerId: userId, orgId }
}

export async function addApprovedUser(email: string, name: string, role: string, password?: string) {
  const { supabase, callerId, orgId } = await requireAdminOrFounder()
  const normalizedEmail = email.toLowerCase().trim()
  const trimmedName = name.trim()

  const { error } = await supabase.from('approved_emails').insert({
    email: normalizedEmail,
    name: trimmedName,
    role,
    added_by: callerId,
    org_id: orgId,
  })
  if (error) throw error

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
      throw new Error(body.error ?? 'Failed to create user account')
    }
  }
  // No revalidatePath here — optimistic update in UsersTable handles the UI.
  // revalidatePath would reset modal state by triggering an RSC refresh.
}

export async function updateApprovedUser(email: string, name: string, role: string, userId: string | null) {
  const { supabase } = await requireAdminOrFounder()
  const trimmedName = name.trim()

  const { error: emailError } = await supabase
    .from('approved_emails')
    .update({ name: trimmedName, role })
    .eq('email', email)
  if (emailError) throw emailError

  // Also update public.users if they have already logged in
  if (userId) {
    await supabase.from('users').update({ name: trimmedName, role }).eq('id', userId)
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
      throw new Error(body.error ?? 'Failed to delete auth account')
    }
  }

  // No revalidatePath for /admin/users — router.refresh() in UsersTable handles that.
  revalidatePath('/admin/partners')
}
