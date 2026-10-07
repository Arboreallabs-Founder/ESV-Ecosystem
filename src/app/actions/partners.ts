'use server'

import { dbFailure } from '@/lib/action-errors'
import { requireAuth, requireRole } from '@/lib/guards'
import { parseBirthday } from '@/lib/birthday'
import { LEDGER_ENTRY_TYPES, PARTNER_TIERS } from '@/lib/types'
import type {
  PartnerDealEarning, MyDealEarning, PartnerShareBase, PartnerReferralTreeNode, PartnerTier,
  PartnerLedgerEntry, PartnerLedgerEntryType, PartnerLedgerSummary,
} from '@/lib/types'
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
    transaction_base: num(r.transaction_base),
    success_base: num(r.success_base),
    carry_base: num(r.carry_base),
    other_base: num(r.other_base),
    split_transaction_pct: num(r.split_transaction_pct),
    split_success_pct: num(r.split_success_pct),
    split_carry_pct: num(r.split_carry_pct),
    is_excluded: !!r.is_excluded,
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

/**
 * Take a deal off a partner's earnings, or put it back.
 *
 * Upsert rather than update: a deal with no share row is on the standard split, and excluding it is
 * the first thing anyone has configured about it. The split is kept either way, so including it
 * again restores what was agreed rather than resetting to the standard.
 */
export async function setPartnerDealExcluded(
  activeDealId: string,
  partnerId: string,
  excluded: boolean,
) {
  const { supabase, orgId } = await requireRole(['founder', 'admin'])
  const { error } = await supabase
    .from('active_deal_partner_shares')
    .upsert(
      {
        active_deal_id: activeDealId,
        partner_id: partnerId,
        org_id: orgId,
        excluded,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'active_deal_id,partner_id' },
    )
  if (error) throw dbFailure('save that', error)
  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/earnings')
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
  // Excluded deals are filtered here, not in SQL: the function has to keep returning them or an
  // admin could never see an exclusion, let alone undo one.
  type MyRow = {
    active_deal_id: string
    deal_title: string | null
    accepted_at: string
    split_pct: number | string | null
    share_amount: number | string | null
    is_excluded: boolean | null
  }
  return ((data ?? []) as MyRow[])
    .filter((r) => !r.is_excluded)
    .map((r) => ({
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

// ── The partner ledger ──────────────────────────────────────────────────────────

const LEDGER_SELECT =
  'id, partner_id, entry_type, amount, entry_date, reference, active_deal_id, note, created_by, created_at, ' +
  'deal:active_deals!active_deal_id(entry:pipeline_entries!pipeline_entry_id(title))'

type LedgerRow = Omit<PartnerLedgerEntry, 'amount' | 'deal'> & {
  amount: number | string
  deal?: { entry?: { title: string | null } | { title: string | null }[] | null }
       | Array<{ entry?: { title: string | null } | { title: string | null }[] | null }>
       | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  (Array.isArray(v) ? v[0] ?? null : v ?? null)

function shapeLedger(rows: LedgerRow[]): PartnerLedgerEntry[] {
  return rows.map((r) => {
    const deal = one(r.deal)
    const entry = deal ? one(deal.entry) : null
    return { ...r, amount: num(r.amount), deal: entry ? { title: entry.title } : null }
  })
}

/**
 * One partner's lines and their balances.
 *
 * RLS scopes the lines — a partner sees their own, internal roles see their org — and the summary
 * function re-checks the caller itself. Fetched together so a balance is never rendered beside a
 * list it was not computed from.
 */
export async function getPartnerLedger(partnerId: string): Promise<{
  entries: PartnerLedgerEntry[]
  summary: PartnerLedgerSummary
}> {
  const { supabase } = await requireRole(['founder', 'admin', 'associate', 'hr', 'franchise_partner'])
  const [entriesRes, summaryRes] = await Promise.all([
    supabase.from('partner_ledger_entries').select(LEDGER_SELECT)
      .eq('partner_id', partnerId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.rpc('get_partner_ledger_summary', { p_partner_id: partnerId }),
  ])
  if (summaryRes.error) throw dbFailure('load the ledger', summaryRes.error)

  const s = (summaryRes.data ?? [])[0] ?? {}
  return {
    entries: shapeLedger((entriesRes.data ?? []) as unknown as LedgerRow[]),
    summary: {
      buy_in_total: num(s.buy_in_total),
      paid_total: num(s.paid_total),
      adjusted_total: num(s.adjusted_total),
      payout_total: num(s.payout_total),
      buy_in_outstanding: num(s.buy_in_outstanding),
      earnings_settled: num(s.earnings_settled),
    },
  }
}

/**
 * A partner's own account. Same shape, their own id — they never pass one in.
 *
 * The id comes back with it so the page has a real one to render rather than a placeholder. The
 * partner cannot write to the ledger either way, but a component holding an empty string that
 * happens never to be used is a trap for whoever makes it editable later.
 */
export async function getMyLedger(): Promise<{
  partnerId: string
  entries: PartnerLedgerEntry[]
  summary: PartnerLedgerSummary
} | null> {
  const { supabase, userId } = await requireRole(['franchise_partner'])
  const { data: row } = await supabase
    .from('users').select('franchise_partner_id').eq('id', userId).single()
  const partnerId = row?.franchise_partner_id
  if (!partnerId) return null
  return { partnerId, ...(await getPartnerLedger(partnerId)) }
}

/**
 * Add a line.
 *
 * Founder/admin only: every one of these is a statement about money that has or has not moved.
 * A receipt is required on a payout — "we paid him" with nothing to reconcile against a bank
 * statement is the gap this table was built to close — and optional elsewhere, since a buy-in being
 * charged has no receipt and a partner's own payment may arrive before its reference does.
 */
export async function addPartnerLedgerEntry(input: {
  partnerId: string
  entryType: PartnerLedgerEntryType
  amount: number
  entryDate: string
  reference?: string | null
  activeDealId?: string | null
  note?: string | null
}) {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])

  if (!(LEDGER_ENTRY_TYPES as readonly string[]).includes(input.entryType)) {
    throw new UserFacingError('That is not a kind of ledger entry.')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new UserFacingError('Give the amount, as a number greater than zero. The kind of entry decides which way it moves.')
  }
  if (input.entryType === 'payout' && !input.reference?.trim()) {
    throw new UserFacingError('A payout needs a receipt or UTR number — without one it cannot be reconciled against the bank.')
  }

  const { error } = await supabase.from('partner_ledger_entries').insert({
    org_id: orgId,
    partner_id: input.partnerId,
    entry_type: input.entryType,
    amount: input.amount,
    entry_date: input.entryDate,
    reference: input.reference?.trim() || null,
    active_deal_id: input.activeDealId || null,
    note: input.note?.trim() || null,
    created_by: userId,
  })
  if (error) throw dbFailure('save that', error)

  revalidatePath(`/admin/partners/${input.partnerId}`)
  revalidatePath('/earnings')
}

/**
 * Remove a line.
 *
 * Deleted rather than reversed. A ledger of record would want a contra entry, but this one is
 * maintained by hand and a mistyped amount corrected with a second line reads as two movements
 * where there was none. Founder/admin only, like writing one.
 */
export async function deletePartnerLedgerEntry(entryId: string, partnerId: string) {
  const { supabase } = await requireRole(['founder', 'admin'])
  const { data, error } = await supabase
    .from('partner_ledger_entries').delete().eq('id', entryId).select('id')
  if (error) throw dbFailure('remove that entry', error)
  if (!data || data.length === 0) {
    throw new UserFacingError('That entry could not be removed. Reload to see the current ledger.')
  }
  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/earnings')
}
