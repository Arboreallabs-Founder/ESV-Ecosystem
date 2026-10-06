import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeals, fetchAllDealDocuments, fetchCategories } from '@/lib/active-deals'
import { createClient } from '@/lib/supabase/server'
import { fetchCompanyOptions } from '@/lib/companies'
import ActiveDealsList from '../active-deals/_components/ActiveDealsList'

/**
 * Closed deals, out of the working list.
 *
 * Narrower than /active-deals on purpose: founder, admin and associate only. A completed deal is a
 * finished cap table and a fee record — who put in what, and what each partner is owed on it — and
 * that is a different disclosure from the pipeline `general`, `hr` and partners can see. The page
 * gate is the first half of that; RLS on the rows is the half that matters, and is unchanged.
 *
 * Same list component as Active Deals rather than a second one. The cards, filters, documents and
 * modals are identical work; only which half of the lifecycle they show differs, so that is the
 * only thing that is a parameter.
 */
export default async function CompletedDealsPage() {
  const supabase = await createClient()
  const [user, deals, categories, companyOptions, { data: teamRows }, documentsByDeal] = await Promise.all([
    getUser(), fetchActiveDeals(), fetchCategories(), fetchCompanyOptions(),
    supabase.from('users').select('id, name, photo_url, designation, email, phone'),
    fetchAllDealDocuments(),
  ])
  if (!user || !['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/active-deals')

  const team = (teamRows ?? []) as Array<{
    id: string; name: string | null; photo_url: string | null
    designation: string | null; email: string | null; phone: string | null
  }>

  return (
    <ActiveDealsList
      deals={deals}
      categories={categories}
      companyOptions={companyOptions}
      userRole={user.role ?? 'associate'}
      team={team}
      documentsByDeal={documentsByDeal}
      scope="completed"
    />
  )
}
