import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeals, fetchCategories } from '@/lib/active-deals'
import ActiveDealsList from './_components/ActiveDealsList'

export default async function ActiveDealsPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin', 'associate'].includes(user.role)) redirect('/login')

  const [deals, categories] = await Promise.all([fetchActiveDeals(), fetchCategories()])
  return <ActiveDealsList deals={deals} categories={categories} />
}
