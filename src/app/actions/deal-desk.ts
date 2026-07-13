'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { parseDeskCsv } from '@/lib/deal-desk-csv'
import { findOrCreateCompanyForDeskDeal } from '@/lib/company-sync'
import { DESK_ACTION_TO_STATUS, type DeskActionType, type DeskStage, type DeskValuationType, type DeskRevenueStatus, type DeskInstrument, type DeskRoundStatus } from '@/lib/types'

async function requireReviewer() {
  return requireRole(['founder', 'admin'])
}

// Authors create/manage their own cards. Admins can author too (they're also reviewers).
async function requireAuthor() {
  return requireRole(['associate', 'admin'])
}

// ── CSV import (associates) ─────────────────────────────────────────────────────

export type ImportResult = {
  inserted: number
  errors: { row: number; message: string }[]
}

export async function importDealsCsv(csvText: string): Promise<ImportResult> {
  const { supabase, userId, orgId } = await requireAuthor()

  const { rows, errors } = parseDeskCsv(csvText)
  if (rows.length === 0) return { inserted: 0, errors }

  // Every imported card materialises into a Company Profile (create-or-link by name), so all
  // the data is captured regardless of go/no-go, and the card links back.
  const payload: Array<Record<string, unknown>> = []
  for (const r of rows) {
    let companyId: string | null = null
    try { companyId = await findOrCreateCompanyForDeskDeal(supabase, orgId, userId, r as unknown as Record<string, unknown>) }
    catch { companyId = null }
    payload.push({ ...r, org_id: orgId, associate_id: userId, company_id: companyId })
  }
  const { data, error } = await supabase.from('desk_deals').insert(payload).select('id')
  if (error) throw error

  revalidatePath('/deal-desk')
  revalidatePath('/companies')
  return { inserted: data?.length ?? 0, errors }
}

// ── Author edits (associates) ───────────────────────────────────────────────────

// Fields an author may edit on their own card. Enum-typed values are validated by the DB.
export type DeskDealPatch = {
  company_name?: string
  sector?: string | null
  about?: string | null
  location?: string | null
  stage?: DeskStage | null
  ask_inr?: number | null
  valuation_type?: DeskValuationType | null
  valuation_inr?: number | null
  dilution_percent?: number | null
  cap_table_notable_names?: string[]
  cap_table_structure_notes?: string | null
  revenue_status?: DeskRevenueStatus | null
  usp?: string | null
  notes?: string | null
  pitch_deck_url?: string | null
  business_model?: string | null
  instrument?: DeskInstrument | null
  round_status?: DeskRoundStatus | null
  committed_inr?: number | null
  total_raised_inr?: number | null
  gross_margin_pct?: number | null
  monthly_burn_inr?: number | null
  runway_months?: number | null
  customers_count?: number | null
  analyst_opinion?: string | null
  referrer?: string | null
}

export async function updateDeskDeal(id: string, patch: DeskDealPatch) {
  const { supabase } = await requireAuthor()
  if (patch.company_name !== undefined) {
    const name = patch.company_name.trim()
    if (!name) throw new Error('Company name is required.')
    if (name.length > 40) throw new Error('Company name exceeds 40 characters.')
    patch = { ...patch, company_name: name }
  }
  if (patch.analyst_opinion !== undefined) {
    const op = patch.analyst_opinion?.trim() || null
    if (op && op.length > 100) throw new Error('Analyst opinion exceeds 100 characters.')
    patch = { ...patch, analyst_opinion: op }
  }
  // Normalise referrer (trim) for consistent grouping in later BI/reporting.
  if (patch.referrer !== undefined) {
    patch = { ...patch, referrer: patch.referrer?.trim() || null }
  }
  // RLS ensures the caller owns the row; no cross-associate edits possible.
  const { error } = await supabase.from('desk_deals').update(patch).eq('id', id)
  if (error) throw error
  revalidatePath('/deal-desk')
}

export async function withdrawDeskDeal(id: string) {
  const { supabase } = await requireAuthor()
  const { error } = await supabase.from('desk_deals').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/deal-desk')
}

// ── Gallery (associates own their deal's media) ─────────────────────────────────

export async function addDealMedia(dealId: string, path: string) {
  const { supabase, orgId } = await requireAuthor()
  // sort_order = current count (append to the end).
  const { count } = await supabase
    .from('desk_deal_media')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)
  const { error } = await supabase
    .from('desk_deal_media')
    .insert({ deal_id: dealId, org_id: orgId, url: path, sort_order: count ?? 0 })
  if (error) throw error
  revalidatePath('/deal-desk')
}

export async function removeDealMedia(mediaId: string) {
  const { supabase } = await requireAuthor()
  // Remove the storage object too (path stored in `url`).
  const { data } = await supabase.from('desk_deal_media').select('url').eq('id', mediaId).single()
  const { error } = await supabase.from('desk_deal_media').delete().eq('id', mediaId)
  if (error) throw error
  if (data?.url) await supabase.storage.from('deal-desk').remove([data.url])
  revalidatePath('/deal-desk')
}

// ── Reviewer actions (founders/admins) ──────────────────────────────────────────

export async function setSeen(id: string, seen: boolean) {
  const { supabase } = await requireReviewer()
  const { error } = await supabase.from('desk_deals').update({ seen_status: seen }).eq('id', id)
  if (error) throw error
  revalidatePath('/deal-desk')
}

export async function toggleStar(id: string, starred: boolean) {
  const { supabase } = await requireReviewer()
  const { error } = await supabase.from('desk_deals').update({ starred }).eq('id', id)
  if (error) throw error
  revalidatePath('/deal-desk')
}

/**
 * Record an MD action on a card. Inserts an audit row (routed back to the author),
 * moves the card into the matching deal_status, and marks it seen.
 * `need_more_info` may carry a text comment and/or a recorded voice-note path.
 */
export async function actOnDeal(
  id: string,
  params: { actionType: DeskActionType; commentText?: string | null; voiceNotePath?: string | null },
) {
  const { supabase, userId, orgId } = await requireReviewer()

  const comment = params.commentText?.trim() || null
  const voice = params.voiceNotePath || null
  if (params.actionType === 'need_more_info' && !comment && !voice) {
    throw new Error('Add a comment or a voice note to request more info.')
  }

  const { error: actionErr } = await supabase.from('desk_deal_actions').insert({
    deal_id: id,
    org_id: orgId,
    action_type: params.actionType,
    comment_text: comment,
    voice_note_url: voice,
    created_by: userId,
  })
  if (actionErr) throw actionErr

  const { error: dealErr } = await supabase
    .from('desk_deals')
    .update({ deal_status: DESK_ACTION_TO_STATUS[params.actionType], seen_status: true })
    .eq('id', id)
  if (dealErr) throw dealErr

  revalidatePath('/deal-desk')
}
