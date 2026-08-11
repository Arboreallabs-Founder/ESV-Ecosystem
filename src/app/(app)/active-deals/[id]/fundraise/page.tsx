import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal } from '@/lib/active-deals'
import { fetchFundraiseList, countApprovedNotOnFundraiseList } from '@/lib/fundraise'
import { fetchCompany } from '@/lib/companies'
import FundraiseClient from './_components/FundraiseClient'

/**
 * The Fundraise Status List for a mandate.
 *
 * Associate-level work, so associates have the same access as founders and admins (§12). Partners
 * are not part of this: it is the mandate being worked, not a referral being tracked.
 */
export default async function FundraisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/dashboard')

  // Independent of each other, so they go together rather than one waiting on the next.
  const [deal, list, pending] = await Promise.all([
    fetchActiveDeal(id),
    fetchFundraiseList(id),
    countApprovedNotOnFundraiseList(id),
  ])
  if (!deal) notFound()

  // The sector a rejection is recorded against. Read from the linked company rather than widening
  // the deal projection, which every other deal query would then carry.
  const company = deal.entry?.company_id ? await fetchCompany(deal.entry.company_id) : null

  return (
    <FundraiseClient
      list={list}
      dealId={id}
      dealName={deal.entry?.title ?? 'this deal'}
      // Carried so a rejection records what was being rejected, not just that one happened.
      companySector={company?.sectors?.[0] ?? null}
      pendingApproved={pending.approved}
      investorListId={pending.listId}
    />
  )
}
