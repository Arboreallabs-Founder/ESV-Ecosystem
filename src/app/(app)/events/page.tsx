import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEvents } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import EventsView from './_components/EventsView'

export default async function UpcomingEventsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const canManage = ['founder', 'admin'].includes(user.role ?? '')
  // canEdit is edit-anything; canCreate is may-add-an-event. Associates have the second but not
  // the first — they can fix an event they created, which EventsView works out per card.
  const canEdit = canManage || user.role === 'hr'
  const canCreate = canEdit || user.role === 'associate'
  const supabase = await createClient()
  const [events, { data: internalUsers }] = await Promise.all([
    fetchEvents(),
    canManage
      ? supabase.from('users').select('id, name').in('role', ['founder', 'admin', 'associate', 'general', 'hr']).order('name')
      : Promise.resolve({ data: [] }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => !e.event_date || e.event_date >= today)

  return (
    <EventsView
      events={upcoming}
      canEdit={canEdit}
      canManage={canManage}
      canCreate={canCreate}
      currentUserId={user.id}
      mode="upcoming"
      internalUsers={(internalUsers ?? []) as Array<{ id: string; name: string }>}
    />
  )
}
