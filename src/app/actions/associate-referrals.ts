'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

/**
 * An internal team member's own referral link, on the associate form.
 *
 * Idempotent, same as the partner version: one link, kept and reused, rather than a new one every
 * time someone opens the page. Open to every internal role, not just associate — the attribution
 * trigger (20261007000000) already credits whoever created the link, and there is no reason a
 * founder or HR referring a company should be routed differently.
 */
export async function getOrCreateMyAssociateReferralLink(): Promise<{ token: string }> {
  const { supabase, userId } = await requireRole(['founder', 'admin', 'associate', 'general', 'hr'])

  const { data: form, error: fErr } = await supabase
    .from('forms').select('id, published').eq('is_associate_form', true).maybeSingle()
  if (fErr) throw dbFailure('load the referral form', fErr)
  if (!form) throw new UserFacingError('No associate referral form exists yet. Ask an admin to set one up.')
  if (!form.published) {
    throw new UserFacingError('The associate referral form is unpublished, so a link would not work. Ask an admin to publish it.')
  }

  const { data: existing } = await supabase
    .from('form_links')
    .select('token')
    .eq('form_id', form.id)
    .eq('created_by', userId)
    .limit(1)
    .maybeSingle()
  if (existing) return { token: existing.token as string }

  const { data: me } = await supabase.from('users').select('name').eq('id', userId).single()
  const { data, error } = await supabase
    .from('form_links')
    .insert({ form_id: form.id, created_by: userId, label: me?.name ? `${me.name} — referrals` : 'Associate referrals' })
    .select('token')
    .single()
  if (error) throw dbFailure('create your referral link', error)

  revalidatePath('/referrals')
  revalidatePath('/admin/referrals')
  revalidatePath('/deal-desk')
  return { token: data.token as string }
}
