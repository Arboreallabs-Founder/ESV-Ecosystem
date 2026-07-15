import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeals, fetchCategories } from '@/lib/active-deals'
import { fetchCompanyOptions } from '@/lib/companies'
import ActiveDealsList from './_components/ActiveDealsList'

export default async function ActiveDealsPage() {
  const [user, deals, categories, companyOptions] = await Promise.all([getUser(), fetchActiveDeals(), fetchCategories(), fetchCompanyOptions()])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')

  return <ActiveDealsList deals={deals} categories={categories} companyOptions={companyOptions} userRole={user.role ?? 'associate'} />
}
