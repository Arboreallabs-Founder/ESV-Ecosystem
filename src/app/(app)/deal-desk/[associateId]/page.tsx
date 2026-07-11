import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchDeskDeals, fetchAssociateName } from '@/lib/deal-desk'
import DeskModule from '../_components/DeskModule'

// Bookmarkable per-associate feed. Reviewers (founder/admin) review one author's cards
// here (mobile card view by default — this is the MD's phone bookmark). An associate
// hitting their own id sees their own board; any other id returns nothing via RLS.
export default async function AssociateFeedPage({ params }: { params: Promise<{ associateId: string }> }) {
  const { associateId } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  const role = user.role ?? ''

  const isReviewer = role === 'founder' || role === 'admin' || role === 'super_admin'
  // Authors (associates + admins) own their board when viewing their own id.
  const isOwn = (role === 'associate' || role === 'admin') && user.id === associateId

  if (!isReviewer && !isOwn) {
    // Associates can only view their own feed.
    redirect('/deal-desk')
  }

  const [deals, name] = await Promise.all([
    fetchDeskDeals(associateId),
    isReviewer ? fetchAssociateName(associateId) : Promise.resolve(user.name),
  ])

  return (
    <DeskModule
      deals={deals}
      orgId={user.org_id ?? ''}
      canReview={isReviewer}
      isOwnBoard={isOwn}
      title={isOwn ? 'My Deal Desk' : (name ?? 'Deal feed')}
      subtitle={isOwn ? 'Submit and manage your deal summaries.' : 'Review and act on these deal cards.'}
      defaultView={isOwn ? 'desktop' : 'mobile'}
    />
  )
}
