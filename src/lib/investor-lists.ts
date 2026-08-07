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

// ── Suggestions ──────────────────────────────────────────────────────────────

export type FundSuggestion = {
  id: string
  name: string
  website: string | null
  sectors: string[]
  excluded_sectors: string[]
  connect_strength: ConnectStrength
  score: number
  /** Why it is being suggested, in words — a ranked list nobody can interrogate is not usable. */
  reasons: string[]
}

/** Loose match so "HealthTech" finds "Health Tech" and "healthcare". */
const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function sectorsOverlap(a: string[], b: string[]): string[] {
  const bb = new Map(b.map((x) => [canon(x), x]))
  const out: string[] = []
  for (const x of a) {
    const hit = bb.get(canon(x))
    if (hit) out.push(hit)
  }
  return out
}

/**
 * Funds worth putting in front of whoever is building the list, ranked.
 *
 * Two things this deliberately does NOT do. It does not auto-add anything — an associate decides,
 * and a score is a prompt rather than a verdict. And it does not silently drop the funds it cannot
 * score: 17 of the 276 have no sectors recorded, and a suggestion engine that hides them would
 * quietly make the thinnest records invisible forever.
 */
export const suggestFunds = cache(async (dealId: string): Promise<FundSuggestion[]> => {
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('active_deals')
    .select('entry:pipeline_entries(company:companies!company_id(sectors, stage))')
    .eq('id', dealId)
    .maybeSingle()

  const entry = Array.isArray((deal as any)?.entry) ? (deal as any).entry[0] : (deal as any)?.entry
  const company = Array.isArray(entry?.company) ? entry.company[0] : entry?.company
  const dealSectors: string[] = company?.sectors ?? []

  const [{ data: funds }, { data: onLists }] = await Promise.all([
    supabase
      .from('investors')
      .select('id, name, website, sectors, excluded_sectors, connect_strength, contacts:investor_contacts(rank, employment_status)')
      .neq('service_type', 'angel_investor'),
    // Already on a list for this deal — suggesting them again is noise.
    supabase
      .from('investor_list_items')
      .select('investor_id, list:investor_lists!list_id(active_deal_id)'),
  ])

  const already = new Set(
    (onLists ?? [])
      .filter((r: any) => {
        const l = Array.isArray(r.list) ? r.list[0] : r.list
        return l?.active_deal_id === dealId
      })
      .map((r: any) => r.investor_id),
  )

  const out: FundSuggestion[] = []
  for (const f of (funds ?? []) as any[]) {
    if (already.has(f.id)) continue

    const sectors: string[] = f.sectors ?? []
    const excluded: string[] = f.excluded_sectors ?? []

    // A stated exclusion is disqualifying, not a penalty. This is the whole reason the exclusions
    // were worth importing: the fund that wrote "no meat" must not appear for a meat startup.
    const clash = sectorsOverlap(dealSectors, excluded)
    if (clash.length > 0) continue

    const reasons: string[] = []
    let score = 0

    const hits = sectorsOverlap(dealSectors, sectors)
    if (hits.length > 0) {
      score += hits.length * 4
      reasons.push(`invests in ${hits.join(', ')}`)
    } else if (sectors.some((s) => canon(s) === 'agnostic')) {
      // Sector-agnostic funds are a genuine match for anything, but a weaker signal than a
      // stated interest, so they rank below a real hit rather than beside it.
      score += 2
      reasons.push('sector agnostic')
    }

    if (f.connect_strength === 'warm') {
      score += 3
      reasons.push('warm relationship')
    }

    const contacts = (f.contacts ?? []) as any[]
    const livePrimary = contacts.find((c) => c.rank === 'primary' && c.employment_status === 'active')
    if (livePrimary) {
      score += 2
      reasons.push('primary contact still there')
    } else if (contacts.length > 0 && contacts.every((c) => c.employment_status === 'moved_on')) {
      // Not disqualifying, but worth knowing before someone builds a list around them.
      score -= 2
      reasons.push('everyone we knew there has left')
    }

    if (score > 0) out.push({ ...f, sectors, excluded_sectors: excluded, score, reasons })
  }

  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 30)
})

/** Sectors the deal's company is tagged with — shown so the ranking is explicable. */
export const fetchDealSectors = cache(async (dealId: string): Promise<string[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_deals')
    .select('entry:pipeline_entries(company:companies!company_id(sectors))')
    .eq('id', dealId)
    .maybeSingle()
  const entry = Array.isArray((data as any)?.entry) ? (data as any).entry[0] : (data as any)?.entry
  const company = Array.isArray(entry?.company) ? entry.company[0] : entry?.company
  return company?.sectors ?? []
})
