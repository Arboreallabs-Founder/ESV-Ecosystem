import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Investor, InvestorEditLogEntry } from './types'

export const fetchAllInvestors = cache(async (): Promise<Investor[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investors')
    .select(`
      id, name, country, website, sectors, business_types, meta_tags, service_type,
      esv_poc_id, ticket_size_min, ticket_size_max, stage,
      referred_by_partner_id, created_by, created_at, username,
      onboarding_form_completed, onboarding_form_url, kyc_done,
      birthday_md, birthday_year,
      excluded_sectors, connect_strength, stage_min, stage_max, stage_raw,
      ticket_currency, esv_poc_names, import_source,
      poc_search_task_id, poc_search_started_at, notes,
      esv_poc:users!esv_poc_id(name),
      esv_pocs:investor_poc_users(user:users(id, name, photo_url)),
      referred_by_partner:franchise_partners!referred_by_partner_id(name),
      contacts:investor_contacts(
        id, investor_id, name, role, linkedin_url, linkedin_status,
        phone, email, sort_order, created_at,
        rank, employment_status, new_company, new_designation, audit_note,
        last_verified_at, contacted_by_user_id, contacted_by_name, contact_method
      )
    `)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row: any) => ({
    ...row,
    sectors: row.sectors ?? [],
    business_types: row.business_types ?? [],
    meta_tags: row.meta_tags ?? [],
    excluded_sectors: row.excluded_sectors ?? [],
    connect_strength: row.connect_strength ?? 'unknown',
    esv_poc_names: row.esv_poc_names ?? [],
    onboarding_form_completed: row.onboarding_form_completed ?? false,
    onboarding_form_url: row.onboarding_form_url ?? null,
    kyc_done: row.kyc_done ?? false,
    birthday_md: row.birthday_md ?? null,
    birthday_year: row.birthday_year ?? null,
    esv_poc: Array.isArray(row.esv_poc) ? (row.esv_poc[0] ?? null) : (row.esv_poc ?? null),
    esv_pocs: (row.esv_pocs ?? []).map((p: any) => {
      const user = Array.isArray(p.user) ? p.user[0] : p.user
      return { id: user?.id, name: user?.name }
    }).filter((p: any) => p.id),
    referred_by_partner: Array.isArray(row.referred_by_partner)
      ? (row.referred_by_partner[0] ?? null)
      : (row.referred_by_partner ?? null),
    contacts: (row.contacts ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  })) as Investor[]
})

// Founder/admin-only audit trail of investor edits (RLS restricts the SELECT to those roles).
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
 * Separate from fetchAllInvestors rather than reusing it: the list does not need the portfolio,
 * and pulling every investor to render one is the kind of thing that is fine at 162 rows and not
 * at 436.
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
      poc_search_task_id, poc_search_started_at, notes,
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
