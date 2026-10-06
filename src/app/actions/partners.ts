'use server'

import { dbFailure } from '@/lib/action-errors'
import { requireAuth, requireRole } from '@/lib/guards'
import { parseBirthday } from '@/lib/birthday'
import { PARTNER_TIERS } from '@/lib/types'
import type { PartnerDealEarning, MyDealEarning, PartnerShareBase, PartnerReferralTreeNode, PartnerTier } from '@/lib/types'
import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'

/**
 * The tier off the form, defaulting to SGP.
 *
 * Validated rather than cast: it is an HTTP parameter, and the value decides whether this partner
 * sees every deal on the portal or only the ones they are named on. An unrecognised value falls
 * back to 'venture', the closed end — a typo must not widen access.
 */
function readTier(formData: FormData): PartnerTier {
  const raw = (formData.get('partner_tier') as string | null)?.trim()
  if (!raw) return 'sgp'
  return (PARTNER_TIERS as readonly string[]).includes(raw) ? (raw as PartnerTier) : 'venture'
}

export async function upsertPartnerDetails(userId: string, formData: FormData) {
  const { supabase, orgId } = await requireAuth()

  const birthday = parseBirthday(formData.get('contact_birthday_md') as string)

  const { data: partner, error: insertError } = await supabase
    .from('franchise_partners')
    .insert({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
      contact_birthday_md: birthday.md,
      contact_birthday_year: birthday.year,
      partner_tier: readTier(formData),
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

  const birthday = parseBirthday(formData.get('contact_birthday_md') as string)

  const { error } = await supabase
    .from('franchise_partners')
    .update({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
      contact_birthday_md: birthday.md,
      contact_birthday_year: birthday.year,
      partner_tier: readTier(formData),
    })
    .eq('id', partnerId)

  if (error) throw dbFailure('save that', error)
  // router.refresh() in the component handles the UI update
}

// ── Partner earnings (deal shares) ──────────────────────────────────────────────

// Postgres NUMERIC comes back as a string over the wire — coerce to number.
const num = (v: unknown): number => (v == null ? 0 : Number(v))

// Admin/founder/associate: full per-deal earnings breakdown for one partner.
export async function getPartnerEarnings(partnerId: string): Promise<PartnerDealEarning[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'hr'])
  const { data, error } = await supabase.rpc('get_partner_earnings', { p_partner_id: partnerId })
  if (error) throw dbFailure('save that', error)
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
  const { supabase, orgId } = await requireRole(['founder', 'admin', 'hr'])
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
  if (error) throw dbFailure('save that', error)
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
  if (error) throw dbFailure('save that', error)
  return (data ?? []).map((r: any) => ({
    active_deal_id: r.active_deal_id,
    deal_title: r.deal_title,
    accepted_at: r.accepted_at,
    split_pct: num(r.split_pct),
    share_amount: num(r.share_amount),
  }))
}

// ── The referral tree ───────────────────────────────────────────────────────────

/** What the RPC returns over the wire: NUMERIC arrives as a string, counts as bigint strings. */
type TreeRpcRow = {
  investor_id: string
  investor_name: string
  service_type: string | null
  parent_investor_id: string | null
  depth: number | string
  invested_total: number | string | null
  deal_count: number | string | null
}

const treeRows = (data: unknown): PartnerReferralTreeNode[] =>
  ((data ?? []) as TreeRpcRow[]).map((r) => ({
    investor_id: r.investor_id,
    investor_name: r.investor_name,
    service_type: r.service_type ?? null,
    parent_investor_id: r.parent_investor_id ?? null,
    depth: Number(r.depth) || 1,
    invested_total: num(r.invested_total),
    deal_count: Number(r.deal_count) || 0,
  }))

/**
 * One partner's referral tree: everyone who rolls up to them, however many hops away.
 *
 * The function behind this re-checks the caller itself (SECURITY DEFINER), because a partner cannot
 * select the chain — their investors policy pins them to rows they referred *directly*, which is
 * now a strict subset of their subtree. Reading it through RLS would show them a tree with the
 * branches missing, which is worse than refusing it.
 */
export async function getPartnerReferralTree(partnerId: string): Promise<PartnerReferralTreeNode[]> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'hr'])
  const { data, error } = await supabase.rpc('get_partner_referral_tree', { p_partner_id: partnerId })
  if (error) throw dbFailure('load the referral tree', error)
  return treeRows(data)
}

/** A partner's own tree. Same function, their own id — they never pass one in. */
export async function getMyReferralTree(): Promise<PartnerReferralTreeNode[]> {
  const { supabase, userId } = await requireRole(['franchise_partner'])
  const { data: row } = await supabase
    .from('users')
    .select('franchise_partner_id')
    .eq('id', userId)
    .single()
  const partnerId = row?.franchise_partner_id
  if (!partnerId) return []
  const { data, error } = await supabase.rpc('get_partner_referral_tree', { p_partner_id: partnerId })
  if (error) throw dbFailure('load your referral tree', error)
  return treeRows(data)
}

/**
 * Set a partner's tier.
 *
 * Founder/admin only. Moving someone from venture to SGP opens every portal-visible deal in the org
 * to them at once, which is a disclosure decision rather than a profile edit.
 */
export async function setPartnerTier(partnerId: string, tier: PartnerTier) {
  const { supabase } = await requireRole(['founder', 'admin'])
  if (!(PARTNER_TIERS as readonly string[]).includes(tier)) {
    throw new UserFacingError('That is not a partner tier.')
  }
  const { data, error } = await supabase
    .from('franchise_partners')
    .update({ partner_tier: tier })
    .eq('id', partnerId)
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) {
    throw new UserFacingError('That partner could not be updated — they may have been removed.')
  }
  revalidatePath('/admin/partners')
  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/portal')
}
