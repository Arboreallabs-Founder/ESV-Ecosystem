import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchKudosFeed, fetchKudosRecipientOptions } from '@/lib/kudos'
import EngageView from './_components/EngageView'

export default async function EngagePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const canModerate = ['founder', 'admin', 'hr'].includes(user.role ?? '')

  const [feed, recipients] = await Promise.all([
    fetchKudosFeed(),
    fetchKudosRecipientOptions(user.id),
  ])

  return <EngageView feed={feed} recipients={recipients} currentUserId={user.id} canModerate={canModerate} />
}
