import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCoordinators, fetchMySubmissions, fetchPartnerPipeline } from '@/lib/partner-companies'
import MyCompaniesClient from './_components/MyCompaniesClient'

/**
 * The partner's own companies.
 *
 * Submissions are pipeline entries now, not a separate partner_companies table. That change is
 * what makes the stage on each card real: it is read from the entry, so when a coordinator moves
 * the card on the board the partner's view follows with nothing to keep in step.
 *
 * RLS returns only what this partner sourced, so the same query that gives a coordinator the whole
 * pipeline gives a partner their own list — no separate endpoint, and no way for one partner to
 * see another's leads.
 */
export default async function MyCompaniesPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['franchise_partner', 'founder', 'admin', 'associate'].includes(user.role ?? '')) {
    redirect('/dashboard')
  }

  const [submissions, coordinators, pipeline] = await Promise.all([
    fetchMySubmissions(),
    fetchCoordinators(),
    fetchPartnerPipeline(),
  ])

  return (
    <MyCompaniesClient
      submissions={submissions}
      coordinators={coordinators}
      stages={pipeline?.stages ?? []}
      pipelineReady={Boolean(pipeline)}
    />
  )
}
