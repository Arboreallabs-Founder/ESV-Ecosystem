import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal } from '@/lib/active-deals'
import ActiveDealPageClient from '../_components/ActiveDealPageClient'

export default async function ActiveDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, deal] = await Promise.all([getUser(), fetchActiveDeal(id)])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  return <ActiveDealPageClient deal={deal} userRole={user.role ?? 'associate'} />
}
