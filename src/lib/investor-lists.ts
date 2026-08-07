import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ConnectStrength, ServiceType } from '@/lib/types'
import { resolveSectors } from '@/lib/sector-aliases'

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
    logo_url: string | null
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
      id, name, website, logo_url, service_type, sectors, excluded_sectors, connect_strength,
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
    .select('id, name, website, logo_url, service_type, sectors, excluded_sectors, connect_strength, stage_min, stage_max')
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
  logo_url: string | null
  sectors: string[]
  excluded_sectors: string[]
  connect_strength: ConnectStrength
  notes: string | null
  score: number
  /** 'thematic' = they say they invest in this. 'agnostic' = they invest in anything. */
  band: 'thematic' | 'agnostic'
  /** Why it is being suggested, in words — a ranked list nobody can interrogate is not usable. */
  reasons: string[]
}

export type Suggestions = {
  thematic: FundSuggestion[]
  agnostic: FundSuggestion[]
  /** What the deal was matched on, after translation into the investor vocabulary. */
  dealSectors: string[]
  /** Company tags with no investor equivalent — shown so an empty result is explicable. */
  unmatchedSectors: string[]
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
 * Does the fund's own writing mention this sector?
 *
 * The thesis lives in prose the sheets carried — "more AI, Health tech or IP backed companies" —
 * and none of it fits a tag. A fund that wrote that about health tech is a thematic match even if
 * nobody ever tagged it.
 */
function thesisMentions(notes: string | null, sectors: string[]): string[] {
  if (!notes) return []
  const hay = notes.toLowerCase()
  const out: string[] = []
  for (const s of sectors) {
    // Both spellings, since the sheets write "healthtech" and "health tech" interchangeably.
    const tight = canon(s)
    const spaced = s.toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2')
    if (tight.length >= 3 && (hay.replace(/[^a-z0-9]/g, '').includes(tight) || hay.includes(spaced))) {
      out.push(s)
    }
  }
  return out
}

/**
 * Funds worth putting in front of whoever is building the list, in two bands.
 *
 * Thematic and thesis matches come first and are NEVER outranked by a sector-agnostic fund, however
 * warm it is. That is a banding, not a bonus: an additive score let a warm agnostic fund with a
 * live contact (2+3+2) beat a genuine sector match with neither (4), which is backwards — the
 * whole point of the shortlist is that these funds actually invest in this.
 *
 * Agnostic funds are returned separately so they can be added as a deliberate second wave rather
 * than mixed into the first.
 *
 * Two things this deliberately does NOT do. It does not auto-add anything — an associate decides,
 * and a score is a prompt rather than a verdict. And it does not silently drop funds it cannot
 * score: 17 of the 276 have no sectors recorded, and a suggestion engine that hides them would
 * quietly make the thinnest records invisible forever.
 */
export const suggestFunds = cache(async (dealId: string): Promise<Suggestions> => {
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('active_deals')
    .select('entry:pipeline_entries(company:companies!company_id(sectors, stage))')
    .eq('id', dealId)
    .maybeSingle()

  const entry = Array.isArray((deal as any)?.entry) ? (deal as any).entry[0] : (deal as any)?.entry
  const company = Array.isArray(entry?.company) ? entry.company[0] : entry?.company
  const rawSectors: string[] = company?.sectors ?? []

  const [{ data: funds }, { data: onLists }] = await Promise.all([
    supabase
      .from('investors')
      .select('id, name, website, logo_url, sectors, excluded_sectors, connect_strength, notes, contacts:investor_contacts(rank, employment_status)')
      .neq('service_type', 'angel_investor'),
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

  // Companies and investors are tagged from different vocabularies — "Defense" vs "Defence",
  // "FMCG" vs "Consumer" — so the deal's tags are translated before anything is compared. Without
  // this most deals matched nothing and the page showed only agnostic funds, with no clue why.
  const investorVocab = [...new Set(((funds ?? []) as any[]).flatMap((f) => f.sectors ?? []))]
  const { resolved: dealSectors, unresolved: unmatchedSectors } = resolveSectors(rawSectors, investorVocab)

  const thematic: FundSuggestion[] = []
  const agnostic: FundSuggestion[] = []

  for (const f of (funds ?? []) as any[]) {
    if (already.has(f.id)) continue

    const sectors: string[] = f.sectors ?? []
    const excluded: string[] = f.excluded_sectors ?? []

    // A stated exclusion is disqualifying, not a penalty. This is the whole return on importing
    // excluded sectors: the fund that wrote "no meat" must not appear for a meat startup.
    if (sectorsOverlap(dealSectors, excluded).length > 0) continue

    const reasons: string[] = []
    let score = 0

    const tagHits = sectorsOverlap(dealSectors, sectors)
    const thesisHits = thesisMentions(f.notes, dealSectors).filter((h) => !tagHits.includes(h))
    const isAgnostic = sectors.some((s) => canon(s) === 'agnostic')

    if (tagHits.length > 0) {
      score += tagHits.length * 4
      reasons.push(`invests in ${tagHits.join(', ')}`)
    }
    if (thesisHits.length > 0) {
      // Slightly below a tag: prose is a weaker claim than a recorded preference, but it is still
      // the fund's own words about what it wants.
      score += thesisHits.length * 3
      reasons.push(`thesis mentions ${thesisHits.join(', ')}`)
    }

    const isThematic = tagHits.length > 0 || thesisHits.length > 0
    if (!isThematic && !isAgnostic) continue
    if (!isThematic) reasons.push('sector agnostic')

    if (f.connect_strength === 'warm') { score += 3; reasons.push('warm relationship') }

    const contacts = (f.contacts ?? []) as any[]
    if (contacts.find((c) => c.rank === 'primary' && c.employment_status === 'active')) {
      score += 2
      reasons.push('primary contact still there')
    } else if (contacts.length === 0) {
      score -= 2
      reasons.push('no contact on record')
    } else if (contacts.every((c) => c.employment_status === 'moved_on')) {
      score -= 2
      reasons.push('everyone we knew there has left')
    }

    const row: FundSuggestion = {
      id: f.id, name: f.name, website: f.website, logo_url: f.logo_url ?? null,
      sectors, excluded_sectors: excluded,
      connect_strength: f.connect_strength, notes: f.notes ?? null,
      score, band: isThematic ? 'thematic' : 'agnostic', reasons,
    }
    ;(isThematic ? thematic : agnostic).push(row)
  }

  const rank = (a: FundSuggestion, b: FundSuggestion) => b.score - a.score || a.name.localeCompare(b.name)
  return {
    thematic: thematic.sort(rank).slice(0, 40),
    agnostic: agnostic.sort(rank).slice(0, 40),
    dealSectors,
    unmatchedSectors,
  }
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
