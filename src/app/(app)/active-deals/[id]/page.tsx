import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal, fetchActiveDealInvestorSummary, fetchCategories } from '@/lib/active-deals'
import { fetchCompanyOptions } from '@/lib/companies'
import ActiveDealPageClient from '../_components/ActiveDealPageClient'

export default async function ActiveDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, deal, categories, companyOptions, investorSummary] = await Promise.all([
    getUser(),
    fetchActiveDeal(id),
    fetchCategories(),
    fetchCompanyOptions(),
    fetchActiveDealInvestorSummary(id),
  ])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  return (
    <ActiveDealPageClient
      deal={deal}
      userRole={user.role ?? 'associate'}
      categories={categories}
      companyOptions={companyOptions}
      investorSummary={investorSummary}
    />
  )
}
