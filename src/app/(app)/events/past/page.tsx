import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEvents } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import EventsView from '../_components/EventsView'

export default async function PastEventsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general'].includes(user.role ?? '')) redirect('/dashboard')

  const isAdmin = ['founder', 'admin'].includes(user.role ?? '')
  const supabase = await createClient()
  const [events, { data: internalUsers }] = await Promise.all([
    fetchEvents(),
    isAdmin
      ? supabase.from('users').select('id, name').in('role', ['founder', 'admin', 'associate', 'general']).order('name')
      : Promise.resolve({ data: [] }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const past = events
    .filter((e) => e.event_date && e.event_date < today)
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))

  return (
    <EventsView
      events={past}
      isAdmin={isAdmin}
      currentUserId={user.id}
      mode="past"
      internalUsers={(internalUsers ?? []) as Array<{ id: string; name: string }>}
    />
  )
}
