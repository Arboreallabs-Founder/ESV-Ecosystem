'use server'

import { requireAuth, requireRole } from '@/lib/guards'
import type { PartnerDealEarning, MyDealEarning, PartnerShareBase } from '@/lib/types'

export async function upsertPartnerDetails(userId: string, formData: FormData) {
  const { supabase, orgId } = await requireAuth()

  const { data: partner, error: insertError } = await supabase
    .from('franchise_partners')
    .insert({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
      org_id: orgId,
    })
    .select('id')
    .single()

  if (insertError) throw insertError

  const { error: linkError } = await supabase
    .from('users')
    .update({ franchise_partner_id: partner.id })
    .eq('id', userId)

  if (linkError) throw linkError
  // router.refresh() in the component handles the UI update
}

export async function updatePartnerDetails(partnerId: string, formData: FormData) {
  const { supabase } = await requireAuth()

  const { error } = await supabase
    .from('franchise_partners')
    .update({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
    })
    .eq('id', partnerId)

  if (error) throw error
  // router.refresh() in the component handles the UI update
}

// ── Partner earnings (deal shares) ──────────────────────────────────────────────

// Postgres NUMERIC comes back as a string over the wire — coerce to number.
const num = (v: unknown): number => (v == null ? 0 : Number(v))

// Admin/founder/associate: full per-deal earnings breakdown for one partner.
export async function getPartnerEarnings(partnerId: string): Promise<PartnerDealEarning[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  const { data, error } = await supabase.rpc('get_partner_earnings', { p_partner_id: partnerId })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    active_deal_id: r.active_deal_id,
    deal_title: r.deal_title,
    accepted_at: r.accepted_at,
    org_total_earning: num(r.org_total_earning),
    referred_earning: num(r.referred_earning),
    base_type: r.base_type as PartnerShareBase,
    split_pct: num(r.split_pct),
    share_amount: num(r.share_amount),
    is_sourced: !!r.is_sourced,
  }))
}

// Admin/founder: set a deal's share base + split override for a partner.
export async function setPartnerDealShare(
  activeDealId: string,
  partnerId: string,
  baseType: PartnerShareBase,
  splitPct: number | null,
) {
  const { supabase, orgId } = await requireRole(['founder', 'admin'])
  const { error } = await supabase
    .from('active_deal_partner_shares')
    .upsert(
      {
        active_deal_id: activeDealId,
        partner_id: partnerId,
        org_id: orgId,
        base_type: baseType,
        split_pct: splitPct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'active_deal_id,partner_id' },
    )
  if (error) throw error
}

// Partner: only their own final share per deal (no org totals).
export async function getMyEarnings(): Promise<MyDealEarning[]> {
  const { supabase, userId } = await requireRole(['franchise_partner'])
  const { data: row } = await supabase
    .from('users')
    .select('franchise_partner_id')
    .eq('id', userId)
    .single()
  const partnerId = row?.franchise_partner_id
  if (!partnerId) return []
  const { data, error } = await supabase.rpc('get_partner_earnings', { p_partner_id: partnerId })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    active_deal_id: r.active_deal_id,
    deal_title: r.deal_title,
    accepted_at: r.accepted_at,
    split_pct: num(r.split_pct),
    share_amount: num(r.share_amount),
  }))
}
