import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCompanies } from '@/lib/companies'
import CompanyList from './_components/CompanyList'

// Startup Database — internal only.
export default async function CompaniesPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'super_admin', 'general'].includes(user.role ?? '')) redirect('/dashboard')

  const companies = await fetchCompanies()
  const canManage = ['founder', 'admin', 'associate', 'super_admin'].includes(user.role ?? '')
  return <CompanyList companies={companies} canManage={canManage} />
}
