import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchBulletinEventKpi } from '@/lib/bulletin'
import BulletinKpiView from './_components/BulletinKpiView'

export default async function BulletinKpiPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/dashboard')

  const events = await fetchBulletinEventKpi()

  return <BulletinKpiView events={events} />
}
