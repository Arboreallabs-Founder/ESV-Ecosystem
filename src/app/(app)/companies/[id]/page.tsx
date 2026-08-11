import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCompany, fetchCompanyFieldDefs, fetchInvestorSuggestions } from '@/lib/companies'
import { getInternalUsers, getCategories } from '@/app/actions/active-deals'
import { isSgpCoordinator } from '@/lib/partner-companies'
import { createClient } from '@/lib/supabase/server'
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
  const [fieldDefs, team, suggestions, dealCategories, coordinator, { data: partners }] = await Promise.all([
    fetchCompanyFieldDefs(),
    getInternalUsers().catch(() => []),
    fetchInvestorSuggestions(company.sectors, company.meta_tags, company.stage),
    getCategories().catch(() => []),
    isLead ? Promise.resolve(true) : isSgpCoordinator(user.id),
    supabase.from('franchise_partners').select('id, name').order('name'),
  ])

  const canManage = isLead
  const canAuthorCard = ['associate', 'admin'].includes(user.role ?? '')
  const canCreateDeal = ['founder', 'admin', 'associate'].includes(user.role ?? '')
  return <CompanyProfileClient company={company} fieldDefs={fieldDefs} canManage={canManage} canAuthorCard={canAuthorCard} canCreateDeal={canCreateDeal} teamMembers={team} suggestions={suggestions} dealCategories={dealCategories} canCreditPartner={coordinator} franchisePartners={(partners ?? []) as Array<{ id: string; name: string }>} />
}
