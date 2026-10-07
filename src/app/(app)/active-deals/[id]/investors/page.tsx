import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDealSummary } from '@/lib/active-deals'
import { getDealInvestors, getInvestorsForPicker, getInternalUsers, getFranchisePartners } from '@/app/actions/active-deals'
import InvestorSpreadsheet from '../../_components/InvestorSpreadsheet'

export default async function ActiveDealInvestorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, deal] = await Promise.all([getUser(), fetchActiveDealSummary(id)])
  if (!user) redirect('/login')
  // Investor-commitment detail is out of scope for 'general' (read-only support role) —
  // send them back to the deal page rather than into a page they can't load data for.
  if (user.role === 'general') redirect(`/active-deals/${id}`)
  if (!['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  const isReadOnly = user.role === 'franchise_partner'
  // What ESV charges on a deal is not a partner's to read. They reach this page to see the
  // commitments their own referrals are part of; the fee columns and their totals are our margin,
  // and a partner who referred one investor could otherwise price the entire round.
  const canSeeFees = user.role !== 'franchise_partner'

  const [{ investors, dealFieldValues }, allInvestors, internalUsers, franchisePartners] = await Promise.all([
    getDealInvestors(id),
    isReadOnly ? Promise.resolve([]) : getInvestorsForPicker(),
    isReadOnly ? Promise.resolve([]) : getInternalUsers(),
    isReadOnly ? Promise.resolve([]) : getFranchisePartners(),
  ])

  return (
    <InvestorSpreadsheet
      dealId={deal.id}
      dealTitle={deal.title ?? 'Untitled deal'}
      categories={deal.categories}
      isReadOnly={isReadOnly}
      canSeeFees={canSeeFees}
      initialInvestors={investors}
      initialDealFieldValues={dealFieldValues}
      initialAllInvestors={allInvestors}
      initialInternalUsers={internalUsers}
      initialFranchisePartners={franchisePartners}
    />
  )
}
