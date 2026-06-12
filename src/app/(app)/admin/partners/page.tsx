import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPartnerUsers } from '@/lib/partners'
import PartnerTable from './_components/PartnerTable'

export default async function PartnersPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  const partnerUsers = await fetchPartnerUsers()

  return <PartnerTable partnerUsers={partnerUsers} />
}
