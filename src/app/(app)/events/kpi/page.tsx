import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEventKpi } from '@/lib/events'
import EventKpiView from './_components/EventKpiView'

export default async function EventKpiPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const events = await fetchEventKpi()

  return <EventKpiView events={events} />
}
