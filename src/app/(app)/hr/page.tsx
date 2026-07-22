import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchHrPolicies } from '@/lib/hr-zone'
import HrZoneView from './_components/HrZoneView'

export default async function HrZonePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general'].includes(user.role ?? '')) redirect('/dashboard')

  const policies = await fetchHrPolicies()
  const canEdit = ['founder', 'admin', 'general'].includes(user.role ?? '')
  const canDelete = ['founder', 'admin'].includes(user.role ?? '')

  return <HrZoneView policies={policies} canEdit={canEdit} canDelete={canDelete} />
}
