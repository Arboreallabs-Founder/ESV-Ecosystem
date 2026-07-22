import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEvents } from '@/lib/events'
import EventsView from './_components/EventsView'

export default async function UpcomingEventsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general'].includes(user.role ?? '')) redirect('/dashboard')

  const events = await fetchEvents()
  const isAdmin = ['founder', 'admin'].includes(user.role ?? '')
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => !e.event_date || e.event_date >= today)

  return <EventsView events={upcoming} isAdmin={isAdmin} currentUserId={user.id} mode="upcoming" />
}
