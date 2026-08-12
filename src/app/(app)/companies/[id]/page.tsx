import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCompany, fetchCompanyFieldDefs, fetchInvestorSuggestions } from '@/lib/companies'
import { getInternalUsers, getCategories } from '@/app/actions/active-deals'
import { isSgpCoordinator } from '@/lib/partner-companies'
import { createClient } from '@/lib/supabase/server'
import type { PartnerAttributionClaim } from '@/lib/types'
import CompanyProfileClient from '../_components/CompanyProfileClient'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Independent of each other: fetched together rather than one after the other.
  const [user, company] = await Promise.all([getUser(), fetchCompany(id)])
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'super_admin', 'general'].includes(user.role ?? '')) redirect('/dashboard')
  if (!company) notFound()

  const supabase = await createClient()
  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  const [fieldDefs, team, suggestions, dealCategories, coordinator, { data: partners }, { data: claimRow }] = await Promise.all([
    fetchCompanyFieldDefs(),
    getInternalUsers().catch(() => []),
    fetchInvestorSuggestions(company.sectors, company.meta_tags, company.stage),
    getCategories().catch(() => []),
    isLead ? Promise.resolve(true) : isSgpCoordinator(user.id),
    supabase.from('franchise_partners').select('id, name').order('name'),
    // The live claim, if any. Whoever is looking at this company should be able to see that a
    // partner is claiming it and where that has got to, rather than only the settled answer.
    supabase
      .from('partner_attribution_claims')
      .select('*, partner:franchise_partners!partner_id(name)')
      .eq('company_id', id)
      .neq('status', 'rejected')
      .maybeSingle(),
  ])

  const canManage = isLead
  const canAuthorCard = ['associate', 'admin'].includes(user.role ?? '')
  const canCreateDeal = ['founder', 'admin', 'associate'].includes(user.role ?? '')
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  const attributionClaim = claimRow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ({ ...(claimRow as any), partner: one((claimRow as any).partner) } as PartnerAttributionClaim)
    : null

  return <CompanyProfileClient company={company} fieldDefs={fieldDefs} canManage={canManage} canAuthorCard={canAuthorCard} canCreateDeal={canCreateDeal} teamMembers={team} suggestions={suggestions} dealCategories={dealCategories} canCreditPartner={coordinator} franchisePartners={(partners ?? []) as Array<{ id: string; name: string }>} attributionClaim={attributionClaim} />
}
