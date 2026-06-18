import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEscalations } from '@/lib/escalations'
import { getEscalationRecipients, getLinkableEntities } from '@/app/actions/escalations'
import EscalationsList from './_components/EscalationsList'

export default async function EscalationsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role)) redirect('/login')

  const canRaise = ['associate', 'admin'].includes(user.role)

  const [escalations, recipients, linkable] = await Promise.all([
    fetchEscalations(),
    canRaise ? getEscalationRecipients() : Promise.resolve([]),
    canRaise ? getLinkableEntities() : Promise.resolve({ deals: [], entries: [], tasks: [], investors: [] }),
  ])

  return (
    <EscalationsList
      escalations={escalations}
      recipients={recipients}
      linkable={linkable}
      currentUserId={user.id}
      userRole={user.role}
    />
  )
}
