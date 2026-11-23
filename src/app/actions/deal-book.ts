'use server'

import { revalidatePath } from 'next/cache'
import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { requireRole } from '@/lib/guards'
import { DESIGN_SLOTS, type DesignSlot } from '@/lib/deal-book'

/* Deal Book writes (20261124000000). Founders and admins only. Files are uploaded straight from
   the browser to the private `deal-book` bucket (an IM can be larger than a server request allows),
   then these actions record where they went. Paths must sit under the caller's org folder. */

async function lead() {
  const ctx = await requireRole(['founder', 'admin'])
  if (!ctx.orgId) throw new UserFacingError('No organisation found for this account.')
  return ctx as typeof ctx & { orgId: string }
}

function checkPath(path: string | null, orgId: string) {
  if (path !== null && !path.startsWith(`${orgId}/`)) throw new UserFacingError('That file is in the wrong place. Upload it again.')
}

function refresh(dealId?: string) {
  revalidatePath('/deal-book')
  if (dealId) revalidatePath(`/active-deals/${dealId}`)
}

/** Set (or clear, with null) a deal's named IM, no-name IM, or codename. */
export async function saveDealIm(activeDealId: string, patch: { named_path?: string | null; noname_path?: string | null; codename?: string | null }) {
  const { supabase, orgId, userId } = await lead()
  checkPath(patch.named_path ?? null, orgId)
  checkPath(patch.noname_path ?? null, orgId)
  const row: Record<string, unknown> = { active_deal_id: activeDealId, org_id: orgId, updated_by: userId, updated_at: new Date().toISOString() }
  if (patch.named_path !== undefined) row.named_path = patch.named_path
  if (patch.noname_path !== undefined) row.noname_path = patch.noname_path
  if (patch.codename !== undefined) row.codename = patch.codename?.trim() || null
  const { error } = await supabase.from('deal_book_ims').upsert(row, { onConflict: 'active_deal_id' })
  if (error) throw dbFailure('save the IM', error)
  refresh(activeDealId)
}

/** Put deals in the book, in this order. Anything not listed is taken out. */
export async function setDealBookOrder(activeDealIds: string[]) {
  const { supabase, orgId } = await lead()
  const { error: delErr } = await supabase.from('deal_book_items').delete().eq('org_id', orgId)
  if (delErr) throw dbFailure('update the book', delErr)
  if (activeDealIds.length) {
    const { error } = await supabase.from('deal_book_items')
      .insert(activeDealIds.map((id, i) => ({ active_deal_id: id, org_id: orgId, position: i })))
    if (error) throw dbFailure('update the book', error)
  }
  refresh()
}

/** Set (or clear) one of the four designed pages. */
export async function setDealBookDesign(slot: DesignSlot, path: string | null) {
  const { supabase, orgId, userId } = await lead()
  if (!DESIGN_SLOTS.includes(slot)) throw new UserFacingError('Unknown page.')
  checkPath(path, orgId)
  const { error } = await supabase.from('deal_book_settings').upsert(
    { org_id: orgId, [`${slot}_path`]: path, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: 'org_id' },
  )
  if (error) throw dbFailure('save that page', error)
  refresh()
}

/** Show or hide one deal in the book, from its deal page. Shown deals go to the end of the order. */
export async function setDealInBook(activeDealId: string, show: boolean) {
  const { supabase, orgId } = await lead()
  if (show) {
    const { data: last, error: readErr } = await supabase.from('deal_book_items')
      .select('position').eq('org_id', orgId).order('position', { ascending: false }).limit(1).maybeSingle()
    if (readErr) throw dbFailure('add the deal to the book', readErr)
    const { error } = await supabase.from('deal_book_items').upsert(
      { active_deal_id: activeDealId, org_id: orgId, position: ((last?.position as number | undefined) ?? -1) + 1 },
      { onConflict: 'active_deal_id', ignoreDuplicates: true },
    )
    if (error) throw dbFailure('add the deal to the book', error)
  } else {
    const { error } = await supabase.from('deal_book_items').delete().eq('active_deal_id', activeDealId)
    if (error) throw dbFailure('take the deal out of the book', error)
  }
  refresh(activeDealId)
}
