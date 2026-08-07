import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ConnectStrength, ServiceType } from '@/lib/types'

/** Investor lists — reads. Writes go through src/app/actions/investor-lists.ts. */

export type ListItem = {
  id: string
  investor_id: string
  approved: boolean
  decided_at: string | null
  founder_note: string | null
  internal_note: string | null
  sort_order: number
  investor: {
    id: string
    name: string
    website: string | null
    service_type: ServiceType
    sectors: string[]
    excluded_sectors: string[]
    connect_strength: ConnectStrength
    contacts: Array<{ name: string; email: string | null; rank: string; employment_status: string }>
  } | null
}

export type ListExclusion = {
  id: string
  raw_name: string
  reason: string | null
  investor_id: string | null
  matched_at: string | null
  investor?: { id: string; name: string } | null
}

export type InvestorList = {
  id: string
  active_deal_id: string
  name: string
  status: 'draft' | 'shared' | 'closed'
  share_token: string | null
  shared_at: string | null
  intro_note: string | null
  first_viewed_at: string | null
  responded_at: string | null
  founder_note: string | null
  created_at: string
  items: ListItem[]
  exclusions: ListExclusion[]
}

const LIST_SELECT = `
  id, active_deal_id, name, status, share_token, shared_at, intro_note,
  first_viewed_at, responded_at, founder_note, created_at,
  items:investor_list_items(
    id, investor_id, approved, decided_at, founder_note, internal_note, sort_order,
    investor:investors!investor_id(
      id, name, website, service_type, sectors, excluded_sectors, connect_strength,
      contacts:investor_contacts(name, email, rank, employment_status)
    )
  ),
  exclusions:investor_list_exclusions(
    id, raw_name, reason, investor_id, matched_at,
    investor:investors!investor_id(id, name)
  )
`

function shape(row: any): InvestorList {
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return {
    ...row,
    items: (row.items ?? [])
      .map((i: any) => {
        const inv = one<any>(i.investor)
        return {
          ...i,
          investor: inv
            ? {
                ...inv,
                sectors: inv.sectors ?? [],
                excluded_sectors: inv.excluded_sectors ?? [],
                // Primary first: when we do approach them, this is who gets the email.
                contacts: (inv.contacts ?? []).sort((a: any, b: any) =>
                  (a.rank === 'primary' ? 0 : a.rank === 'secondary' ? 1 : 2)
                  - (b.rank === 'primary' ? 0 : b.rank === 'secondary' ? 1 : 2)),
              }
            : null,
        }
      })
      .sort((a: any, b: any) => a.sort_order - b.sort_order),
    exclusions: (row.exclusions ?? []).map((e: any) => ({ ...e, investor: one<any>(e.investor) })),
  }
}

export const fetchListsForDeal = cache(async (dealId: string): Promise<InvestorList[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('investor_lists')
    .select(LIST_SELECT)
    .eq('active_deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[investor-lists] read failed:', error.message)
    return []
  }
  return (data ?? []).map(shape)
})

/** Is this deal tagged Investment Banking? Mirrors deal_is_investment_banking() in the database. */
export const dealIsInvestmentBanking = cache(async (dealId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deal_categories')
    .select('category:deal_categories!category_id(name)')
    .eq('active_deal_id', dealId)
  return (data ?? []).some((r: any) => {
    const c = Array.isArray(r.category) ? r.category[0] : r.category
    return c?.name?.trim().toLowerCase() === 'investment banking'
  })
})

/**
 * Funds that can go on a list: everything except angel investors.
 *
 * Deliberately not filtered by sector here. The builder shows the fund's own sectors and
 * exclusions and lets a person decide — an automatic match on tags would quietly drop funds whose
 * tags are thin, and 17 of these have no sectors recorded at all.
 */
export const fetchSelectableFunds = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, website, service_type, sectors, excluded_sectors, connect_strength, stage_min, stage_max')
    .neq('service_type', 'angel_investor')
    .order('name')
  if (error) {
    console.error('[investor-lists] fund read failed:', error.message)
    return []
  }
  return data ?? []
})
