import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Investor, InvestorListItem, InvestorEditLogEntry } from './types'

/**
 * The investors list.
 *
 * Only the columns the cards, the search, the tabs and the POC badge actually read. The full
 * record — notes, business types, onboarding, every contact — is fetched by the drawer for the one
 * investor being looked at, which is the only time it is needed.
 *
 * This was one query returning everything: 660 KB and ~1.4s for 430 funds, of which the contacts
 * sub-select alone was 251 KB.
 */
export const fetchInvestorsForList = cache(async (): Promise<InvestorListItem[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investors')
    .select(`
      id, name, country, sectors, service_type, stage,
      ticket_size_min, ticket_size_max, ticket_currency, logo_url,
      esv_poc:users!esv_poc_id(name),
      esv_pocs:investor_poc_users(user:users(id, name, photo_url)),
      referred_by_partner:franchise_partners!referred_by_partner_id(name),
      contacts:investor_contacts(id, employment_status)
    `)
    .order('created_at', { ascending: false })

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return (data ?? []).map((row: any) => ({
    ...row,
    sectors: row.sectors ?? [],
    esv_poc: one(row.esv_poc),
    esv_pocs: (row.esv_pocs ?? []).map((p: any) => one(p.user)).filter(Boolean),
    referred_by_partner: one(row.referred_by_partner),
    contacts: row.contacts ?? [],
  })) as InvestorListItem[]
})

/** Who changed what on an investor. Capped at 500 — it is a recent-activity view, not an archive. */
export const fetchInvestorEditLog = cache(async (): Promise<InvestorEditLogEntry[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investor_edit_log')
    .select('id, investor_id, investor_name, edited_by_name, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as InvestorEditLogEntry[]
})

/**
 * One investor, with contacts and portfolio, for the profile page.
 *
 * Separate from the list query rather than reusing it: the list does not need the portfolio, and
 * pulling every investor to render one is the kind of thing that is fine at 162 rows and not at
 * 430.
 */
export const fetchInvestor = cache(async (id: string): Promise<Investor | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('investors')
    .select(`
      id, name, country, website, sectors, business_types, meta_tags, service_type,
      esv_poc_id, ticket_size_min, ticket_size_max, stage,
      referred_by_partner_id, created_by, created_at, username,
      onboarding_form_completed, onboarding_form_url, kyc_done,
      birthday_md, birthday_year,
      excluded_sectors, connect_strength, stage_min, stage_max, stage_raw,
      ticket_currency, esv_poc_names, import_source,
      poc_search_task_id, poc_search_started_at, notes, logo_url,
      esv_pocs:investor_poc_users(user:users(id, name, photo_url)),
      referred_by_partner:franchise_partners!referred_by_partner_id(name),
      contacts:investor_contacts(
        id, investor_id, name, role, linkedin_url, linkedin_status,
        phone, email, sort_order, created_at,
        rank, employment_status, new_company, new_designation, audit_note,
        last_verified_at, contacted_by_user_id, contacted_by_name, contact_method
      ),
      portfolio:investor_portfolio(
        id, investor_id, company_name, company_id, sector_tags, business_type_tags,
        invested_stage, invested_year, notes, created_at,
        company:companies!company_id(id, name, logo_url)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[investors] profile read failed:', error.message)
    return null
  }
  if (!data) return null

  const row = data as any
  const rankOrder = { primary: 0, secondary: 1, other: 2 } as Record<string, number>
  return {
    ...row,
    sectors: row.sectors ?? [],
    business_types: row.business_types ?? [],
    meta_tags: row.meta_tags ?? [],
    excluded_sectors: row.excluded_sectors ?? [],
    connect_strength: row.connect_strength ?? 'unknown',
    esv_poc_names: row.esv_poc_names ?? [],
    onboarding_form_completed: row.onboarding_form_completed ?? false,
    kyc_done: row.kyc_done ?? false,
    esv_pocs: (row.esv_pocs ?? []).map((p: any) => {
      const u = Array.isArray(p.user) ? p.user[0] : p.user
      return u ? { id: u.id, name: u.name, photo_url: u.photo_url ?? null } : null
    }).filter(Boolean),
    // Primary first: the page's first question is "who do I call".
    contacts: (row.contacts ?? []).sort((a: any, b: any) =>
      (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9) || (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    portfolio: (row.portfolio ?? []).map((p: any) => ({
      ...p,
      sector_tags: p.sector_tags ?? [],
      business_type_tags: p.business_type_tags ?? [],
      company: Array.isArray(p.company) ? p.company[0] ?? null : p.company ?? null,
    })).sort((a: any, b: any) => a.company_name.localeCompare(b.company_name)),
  } as Investor
})
