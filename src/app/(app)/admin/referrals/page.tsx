import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllReferralLinks } from '@/lib/associate-referrals'
import ReferralLinksTable from './_components/ReferralLinksTable'

export default async function AdminReferralsPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role ?? '')) redirect('/dashboard')

  const links = await fetchAllReferralLinks()
  return <ReferralLinksTable links={links} />
}
