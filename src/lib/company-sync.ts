// Create-or-link helpers so every deal (Deal Desk card, accepted pipeline deal) materialises
// into a Company Profile without duplicating: an existing company is matched case-insensitively
// by brand OR legal name within the org and linked to; otherwise a new profile is created.
// Plain helpers (take a Supabase client) so both server actions and other actions can reuse them.
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractMetaTags } from '@/lib/company-tags'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, 'public', any>

/** Match an existing company by brand or legal name (case-insensitive) within the org. */
async function findCompanyId(supabase: SB, orgId: string, name: string): Promise<string | null> {
  const clean = name.trim()
  if (!clean) return null
  const like = clean.replace(/[%_\\]/g, (m) => `\\${m}`) // escape LIKE wildcards
  let res = await supabase.from('companies').select('id').eq('org_id', orgId).ilike('name', like).limit(1)
  if (!res.data?.length) res = await supabase.from('companies').select('id').eq('org_id', orgId).ilike('legal_name', like).limit(1)
  return res.data?.length ? (res.data[0].id as string) : null
}

/** Find a company by name, or create a minimal one. Returns { id, created }. */
export async function findOrCreateCompanyByName(
  supabase: SB, orgId: string | null, userId: string, name: string, seed: Record<string, unknown> = {},
): Promise<{ id: string; created: boolean } | null> {
  const clean = name?.trim()
  if (!clean || !orgId) return null
  const existing = await findCompanyId(supabase, orgId, clean)
  if (existing) return { id: existing, created: false }
  const { data, error } = await supabase.from('companies').insert({ ...seed, name: clean, org_id: orgId, created_by: userId }).select('id').single()
  if (error) throw error
  return { id: data.id as string, created: true }
}

/**
 * Find a company for a Deal Desk card by name, or create one richly pre-filled from the card
 * (identity, founders, traction, raise, cap-table names, an initial update). Returns the id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOrCreateCompanyForDeskDeal(supabase: SB, orgId: string | null, userId: string, deal: Record<string, any>): Promise<string | null> {
  const brand = (deal.company_name ?? '').trim()
  if (!brand || !orgId) return null
  const existing = await findCompanyId(supabase, orgId, brand)
  if (existing) return existing

  // ARR run-rate from the card's revenue series.
  let arr: number | null = null
  const rev: Array<{ amount: number }> = deal.revenue_data ?? []
  if (deal.revenue_status === 'Yes' && rev.length > 0) {
    const last = rev[rev.length - 1].amount
    arr = deal.revenue_period === 'Annual' ? last : last * 12
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const founders = (deal.founders ?? []).map((f: Record<string, any>) => ({
    name: f.name, role: null, bio: f.bio ?? null, ex_affiliations: f.affiliation ?? null, linkedin_url: f.linkedin_url ?? null, equity_pct: null,
  }))

  // Themes the AI agent tagged in the CSV, plus keyword-extracted ones as a safety net.
  const explicitTags = Array.isArray(deal.meta_tags) ? (deal.meta_tags as string[]) : []
  const meta_tags = Array.from(new Set([
    ...explicitTags.map((t) => t.trim()).filter(Boolean),
    ...extractMetaTags(brand, deal.about, deal.usp, deal.business_model, deal.notes, deal.sector),
  ]))

  const { data: created, error } = await supabase.from('companies').insert({
    org_id: orgId, created_by: userId, name: brand,
    one_liner: deal.about ?? null, hq_city: deal.location ?? null,
    sectors: deal.sector ? [deal.sector] : [],
    stage: deal.stage ?? null, business_model: deal.business_model ?? null, usp: deal.usp ?? null,
    meta_tags,
    founders,
    arr_inr: arr, customers_count: deal.customers_count ?? null, gross_margin_pct: deal.gross_margin_pct ?? null,
    monthly_burn_inr: deal.monthly_burn_inr ?? null, runway_months: deal.runway_months ?? null,
    ask_inr: deal.ask_inr ?? null, instrument: deal.instrument ?? null, round_status: deal.round_status ?? null,
    total_raised_inr: deal.total_raised_inr ?? null,
    post_money_inr: deal.valuation_type === 'Fixed' ? (deal.valuation_inr ?? null) : null,
  }).select('id').single()
  if (error) throw error
  const companyId = created.id as string

  const notable: string[] = deal.cap_table_notable_names ?? []
  if (notable.length > 0) {
    await supabase.from('company_cap_table').insert(notable.map((n, i) => ({ company_id: companyId, org_id: orgId, holder_name: n, holder_type: 'investor', sort_order: i })))
  }
  const parts: string[] = []
  if (deal.referrer) parts.push(`Referrer: ${deal.referrer}`)
  if (deal.notes) parts.push(deal.notes)
  if (deal.analyst_opinion) parts.push(`Analyst: ${deal.analyst_opinion}`)
  if (parts.length > 0) await supabase.from('company_updates').insert({ company_id: companyId, org_id: orgId, body: parts.join('\n'), author_id: userId })

  return companyId
}

/** Return v if it's a member of the allowed list, else null (for mapping company text → desk enums). */
export function enumOrNull<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : null
}
