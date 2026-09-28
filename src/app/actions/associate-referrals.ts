'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { normaliseSlug } from '@/lib/referral-path'

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']

function revalidateReferrals() {
  revalidatePath('/referrals')
  revalidatePath('/admin/referrals')
  revalidatePath('/deal-desk')
}

/**
 * An internal team member's own referral link, on the associate form.
 *
 * Idempotent, same as the partner version: one link, kept and reused, rather than a new one every
 * time someone opens the page. Open to every internal role, not just associate — the attribution
 * trigger (20261007000000) already credits whoever created the link, and there is no reason a
 * founder or HR referring a company should be routed differently. The readable slug is assigned
 * by a trigger on insert (20261011000000), so it comes back with the row.
 */
export async function getOrCreateMyAssociateReferralLink(): Promise<{ token: string; slug: string | null }> {
  const { supabase, userId } = await requireRole(INTERNAL)

  const { data: form, error: fErr } = await supabase
    .from('forms').select('id, published').eq('is_associate_form', true).maybeSingle()
  if (fErr) throw dbFailure('load the referral form', fErr)
  if (!form) throw new UserFacingError('No associate referral form exists yet. Ask an admin to set one up.')
  if (!form.published) {
    throw new UserFacingError('The associate referral form is unpublished, so a link would not work. Ask an admin to publish it.')
  }

  const { data: existing } = await supabase
    .from('form_links')
    .select('token, slug')
    .eq('form_id', form.id)
    .eq('created_by', userId)
    .limit(1)
    .maybeSingle()
  if (existing) return { token: existing.token as string, slug: (existing.slug as string | null) ?? null }

  const { data: me } = await supabase.from('users').select('name').eq('id', userId).single()
  const { data, error } = await supabase
    .from('form_links')
    .insert({ form_id: form.id, created_by: userId, label: me?.name ? `${me.name} — referrals` : 'Associate referrals' })
    .select('token, slug')
    .single()
  if (error) throw dbFailure('create your referral link', error)

  revalidateReferrals()
  return { token: data.token as string, slug: (data.slug as string | null) ?? null }
}

/**
 * Rename someone's founder link — /apply/<slug>. Your own, or anyone's if you're founder/admin.
 * Changing it retires the old /apply/ address (it stops resolving); the /f/<token> link is
 * unaffected, so anything shared that way keeps working.
 */
export async function setReferralSlug(targetUserId: string, input: string): Promise<{ slug: string }> {
  const { supabase, userId, role } = await requireRole(INTERNAL)
  if (targetUserId !== userId && !['founder', 'admin'].includes(role)) {
    throw new UserFacingError('You can only change your own link.')
  }

  const parsed = normaliseSlug(input)
  if ('error' in parsed) throw new UserFacingError(parsed.error)

  const { data: form, error: fErr } = await supabase
    .from('forms').select('id').eq('is_associate_form', true).maybeSingle()
  if (fErr) throw dbFailure('load the referral form', fErr)
  if (!form) throw new UserFacingError('No founder form exists yet.')

  const { data, error } = await supabase
    .from('form_links')
    .update({ slug: parsed.slug })
    .eq('form_id', form.id)
    .eq('created_by', targetUserId)
    .select('slug')
  if (error) {
    // Unique index on lower(slug): someone already has it.
    if (error.code === '23505') throw new UserFacingError(`"${parsed.slug}" is already taken. Try another.`)
    throw dbFailure('save that link name', error)
  }
  if (!data || data.length === 0) throw new UserFacingError('That person does not have a link yet.')

  revalidateReferrals()
  return { slug: parsed.slug }
}
