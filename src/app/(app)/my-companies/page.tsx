import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPartnerCompanies, fetchCoordinators } from '@/lib/partner-companies'
import MyCompaniesClient from './_components/MyCompaniesClient'

/**
 * The partner's own company database.
 *
 * RLS returns only what this person submitted, so the same query that gives a coordinator the
 * whole queue gives a partner their own list — no separate endpoint, and no way for one partner
 * to see another's leads.
 */
export default async function MyCompaniesPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['franchise_partner', 'founder', 'admin', 'associate'].includes(user.role ?? '')) {
    redirect('/dashboard')
  }

  const [submissions, coordinators] = await Promise.all([
    fetchPartnerCompanies(),
    fetchCoordinators(),
  ])

  // Internal staff can log a company on a partner's behalf, but this page is their own list —
  // the full queue lives on the SGP Desk.
  const mine = submissions.filter((s) => s.submitted_by === user.id)

  return <MyCompaniesClient submissions={mine} coordinators={coordinators} />
}
