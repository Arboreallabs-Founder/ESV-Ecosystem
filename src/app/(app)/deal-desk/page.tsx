import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchDeskAssociates, fetchDeskDeals } from '@/lib/deal-desk'
import DeskRoster from './_components/DeskRoster'
import DeskModule from './_components/DeskModule'

// Role-aware landing:
//   founder/admin (reviewers) → associate roster
//   associate (author)        → their own board (desktop table default, with import)
export default async function DealDeskPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  const role = user.role ?? ''

  if (role === 'founder' || role === 'admin' || role === 'super_admin') {
    const associates = await fetchDeskAssociates()
    // Admins can also author, so give them a direct link to their own board.
    return <DeskRoster associates={associates} selfAuthorId={role === 'admin' ? user.id : undefined} />
  }

  if (role === 'associate') {
    const deals = await fetchDeskDeals(user.id)
    return (
      <DeskModule
        deals={deals}
        orgId={user.org_id ?? ''}
        canReview={false}
        isOwnBoard
        title="My Deal Desk"
        subtitle="Submit and manage your post-call deal summaries."
        defaultView="table"
      />
    )
  }

  redirect('/dashboard')
}
