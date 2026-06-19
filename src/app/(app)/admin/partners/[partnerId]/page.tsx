import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPartnerUsers } from '@/lib/partners'
import { getPartnerEarnings } from '@/app/actions/partners'
import PartnerEarnings from '../_components/PartnerEarnings'

export default async function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  const partnerUsers = await fetchPartnerUsers()
  const partnerUser = partnerUsers.find((u) => u.franchise_partner_id === partnerId)
  if (!partnerUser || !partnerUser.franchise_partners) redirect('/admin/partners')

  const earnings = await getPartnerEarnings(partnerId)

  return (
    <PartnerEarnings
      partnerId={partnerId}
      partnerName={partnerUser.franchise_partners.name || partnerUser.name || 'Partner'}
      standardSplit={partnerUser.franchise_partners.success_fee_split_pct}
      deals={earnings}
    />
  )
}
