import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal } from '@/lib/active-deals'
import InvestorSpreadsheet from '../../_components/InvestorSpreadsheet'

export default async function ActiveDealInvestorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, deal] = await Promise.all([getUser(), fetchActiveDeal(id)])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  return (
    <InvestorSpreadsheet
      dealId={deal.id}
      dealTitle={deal.entry?.title ?? 'Untitled deal'}
      isReadOnly={user.role === 'franchise_partner'}
    />
  )
}
