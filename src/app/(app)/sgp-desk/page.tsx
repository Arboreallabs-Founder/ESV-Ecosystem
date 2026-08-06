import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import {
  fetchPartnerCompanies, fetchAssignableForSgp, isSgpCoordinator,
} from '@/lib/partner-companies'
import SgpDeskClient from './_components/SgpDeskClient'

/**
 * The SGP Desk — partner-sourced companies awaiting triage.
 *
 * Reachable by founders and admins, and by any associate flagged as an SGP Coordinator. An
 * associate without the flag has no reason to see other partners' leads, so they are redirected
 * rather than shown an empty queue.
 */
export default async function SgpDeskPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  const coordinator = isLead ? true : await isSgpCoordinator(user.id)
  if (!coordinator) redirect('/dashboard')

  const [submissions, assignable] = await Promise.all([
    fetchPartnerCompanies(),
    fetchAssignableForSgp(),
  ])

  return (
    <SgpDeskClient
      submissions={submissions}
      assignable={assignable}
      currentUserId={user.id}
    />
  )
}
