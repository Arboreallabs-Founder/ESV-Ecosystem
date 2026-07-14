import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCompany, fetchCompanyFieldDefs, fetchInvestorSuggestions } from '@/lib/companies'
import { getInternalUsers, getCategories } from '@/app/actions/active-deals'
import CompanyProfileClient from '../_components/CompanyProfileClient'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'super_admin'].includes(user.role ?? '')) redirect('/dashboard')

  const company = await fetchCompany(id)
  if (!company) notFound()

  const [fieldDefs, team, suggestions, dealCategories] = await Promise.all([
    fetchCompanyFieldDefs(),
    getInternalUsers().catch(() => []),
    fetchInvestorSuggestions(company.sectors, company.meta_tags, company.stage),
    getCategories().catch(() => []),
  ])

  const canManage = ['founder', 'admin'].includes(user.role ?? '')
  const canAuthorCard = ['associate', 'admin'].includes(user.role ?? '')
  return <CompanyProfileClient company={company} fieldDefs={fieldDefs} canManage={canManage} canAuthorCard={canAuthorCard} teamMembers={team} suggestions={suggestions} dealCategories={dealCategories} />
}
