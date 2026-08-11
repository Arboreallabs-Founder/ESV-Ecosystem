import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeals, fetchAllDealDocuments, fetchCategories, fetchPartnerDealSummaries } from '@/lib/active-deals'
import { createClient } from '@/lib/supabase/server'
import { fetchCompanyOptions } from '@/lib/companies'
import ActiveDealsList from './_components/ActiveDealsList'

export default async function ActiveDealsPage() {
  const supabase = await createClient()
  const [user, deals, categories, companyOptions, { data: teamRows }, documentsByDeal] = await Promise.all([
    getUser(), fetchActiveDeals(), fetchCategories(), fetchCompanyOptions(),
    // Contact details for the people on these deals. `pipeline_entry_assignees` carries a name and
    // a photo; "how do I reach them" needs the rest.
    supabase.from('users').select('id, name, photo_url, designation, email, phone'),
    // The share message is built from the deal's own links, so the list needs them per card.
    fetchAllDealDocuments(),
  ])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner', 'general'].includes(user.role ?? '')) redirect('/login')
  const team = (teamRows ?? []) as Array<{ id: string; name: string | null; photo_url: string | null; designation: string | null; email: string | null; phone: string | null }>

  // Logos and the ESV contact both come from tables a partner cannot read, so for them the cards
  // were coloured initials and "Unassigned". One call fills in every card.
  const partnerSummaries = user.role === 'franchise_partner' ? await fetchPartnerDealSummaries() : {}

  return (
    <ActiveDealsList
      deals={deals}
      categories={categories}
      companyOptions={companyOptions}
      userRole={user.role ?? 'associate'}
      partnerSummaries={partnerSummaries}
      team={team}
      documentsByDeal={documentsByDeal}
    />
  )
}
