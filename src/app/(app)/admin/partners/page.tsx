import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPartnerUsers } from '@/lib/partners'
import PartnerTable from './_components/PartnerTable'

export default async function PartnersPage() {
  const [user, partnerUsers] = await Promise.all([getUser(), fetchPartnerUsers()])
  if (!user || !['founder', 'admin', 'hr'].includes(user.role)) redirect('/dashboard')

  return <PartnerTable partnerUsers={partnerUsers} />
}
