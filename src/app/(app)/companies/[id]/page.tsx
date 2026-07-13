import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCompany, fetchCompanyFieldDefs } from '@/lib/companies'
import { getInternalUsers } from '@/app/actions/active-deals'
import CompanyProfileClient from '../_components/CompanyProfileClient'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'super_admin'].includes(user.role ?? '')) redirect('/dashboard')

  const [company, fieldDefs, team] = await Promise.all([
    fetchCompany(id),
    fetchCompanyFieldDefs(),
    getInternalUsers().catch(() => []),
  ])
  if (!company) notFound()

  const canManage = ['founder', 'admin'].includes(user.role ?? '')
  const canAuthorCard = ['associate', 'admin'].includes(user.role ?? '')
  return <CompanyProfileClient company={company} fieldDefs={fieldDefs} canManage={canManage} canAuthorCard={canAuthorCard} teamMembers={team} />
}
