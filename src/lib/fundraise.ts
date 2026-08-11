import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { FundraiseList } from '@/lib/types'
import { mandateHealth, type MandateHealth } from '@/lib/mandate-health'

/**
 * The Fundraise Status List for a deal.
 *
 * One query with the timeline nested: an entry without its history is only half the record, and
 * fetching the events per fund would be one round trip per row.
 */
export const fetchFundraiseList = cache(async (activeDealId: string): Promise<FundraiseList | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fundraise_lists')
    .select(`
      id, active_deal_id, share_token, shared_at, first_viewed_at, reachout_template, created_at,
      entries:fundraise_entries(
        id, list_id, investor_id, status, status_changed_at, sent_at,
        rejection_reason, rejection_sector, sort_order, created_at,
        investor:investors!investor_id(
          id, name, website, logo_url, sectors, connect_strength,
          contacts:investor_contacts(id, name, rank, employment_status)
        ),
        events:fundraise_events(
          id, entry_id, kind, body, from_status, to_status, founder_visible,
          created_by, author_label, created_at,
          created_by_user:users!created_by(name, photo_url)
        )
      )
    `)
    .eq('active_deal_id', activeDealId)
    .maybeSingle()

  if (error) {
    // The tables arrive with 20260914; until then the page offers to create the list rather than
    // failing the route.
    console.error('[fundraise] read failed:', error.message)
    return null
  }
  if (!data) return null

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  const row = data as any

  return {
    ...row,
    entries: (row.entries ?? [])
      .map((e: any) => ({
        ...e,
        investor: (() => {
          const inv = one(e.investor)
          return inv ? { ...inv, sectors: inv.sectors ?? [], contacts: inv.contacts ?? [] } : null
        })(),
        // Oldest first: a timeline reads forwards.
        events: (e.events ?? [])
          .map((ev: any) => ({ ...ev, created_by_user: one(ev.created_by_user) }))
          .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a: any, b: any) =>
        (a.investor?.name ?? '').localeCompare(b.investor?.name ?? '')),
  } as FundraiseList
})

/**
 * How many funds the founder approved that are not yet on the status list.
 *
 * Shown so the team knows there is something to pull across — §2 says names get added from our end
 * after approval, so this is the normal state rather than an error.
 */
export const countApprovedNotOnFundraiseList = cache(async (activeDealId: string): Promise<{
  approved: number
  listId: string | null
}> => {
  const supabase = await createClient()
  const { data: lists } = await supabase
    .from('investor_lists')
    .select('id, responded_at, items:investor_list_items(investor_id, approved)')
    .eq('active_deal_id', activeDealId)
    .order('created_at', { ascending: false })

  const answered = (lists ?? []).find((l: any) => l.responded_at)
  if (!answered) return { approved: 0, listId: null }

  const approvedIds = new Set(
    ((answered as any).items ?? []).filter((i: any) => i.approved).map((i: any) => i.investor_id),
  )

  const { data: existing } = await supabase
    .from('fundraise_entries')
    .select('investor_id, list:fundraise_lists!list_id(active_deal_id)')

  for (const row of (existing ?? []) as any[]) {
    const list = Array.isArray(row.list) ? row.list[0] : row.list
    if (list?.active_deal_id === activeDealId) approvedIds.delete(row.investor_id)
  }

  return { approved: approvedIds.size, listId: (answered as any).id }
})

/**
 * Health for every mandate that has a fundraise list, keyed by active deal.
 *
 * One query rather than one per deal: the Weekly Update shows several mandates at once, and a
 * round trip each is how a page that reads a dozen rows takes a second to render.
 */
export const fetchMandateHealth = cache(async (): Promise<Record<string, MandateHealth>> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fundraise_lists')
    .select('active_deal_id, entries:fundraise_entries(status, status_changed_at)')

  if (error) {
    console.error('[fundraise] health read failed:', error.message)
    return {}
  }

  const out: Record<string, MandateHealth> = {}
  for (const row of (data ?? []) as any[]) {
    out[row.active_deal_id] = mandateHealth(row.entries ?? [])
  }
  return out
})
