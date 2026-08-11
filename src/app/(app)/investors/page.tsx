import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllInvestors } from '@/lib/investors'
import { fetchMyInvestorReferrals } from '@/lib/partner-companies'
import { createClient } from '@/lib/supabase/server'
import InvestorGrid from './_components/InvestorGrid'

export default async function InvestorsPage() {
  const [user, investors] = await Promise.all([getUser(), fetchAllInvestors()])
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'franchise_partner', 'general', 'hr'].includes(user.role ?? '')) redirect('/login')

  const isInternal = ['founder', 'admin', 'associate', 'hr'].includes(user.role ?? '')
  // Partners no longer create investors (20260905 dropped the INSERT policy), so the button that
  // opened the create form could only ever fail for them. They refer instead, and a coordinator
  // decides — see ReferInvestorPanel.
  const canManage = isInternal
  const isPartner = user.role === 'franchise_partner'
  const referrals = isPartner ? await fetchMyInvestorReferrals() : []
  const supabase = await createClient()
  const [{ data: internalUsers }, { data: franchisePartners }] = await Promise.all([
    isInternal
      ? supabase.from('users').select('id, name').in('role', ['founder', 'admin', 'associate']).order('name')
      : Promise.resolve({ data: [] }),
    ['founder', 'admin', 'hr'].includes(user.role ?? '')
      ? supabase.from('franchise_partners').select('id, name').order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <InvestorGrid
      investors={investors}
      userRole={user.role ?? 'associate'}
      canManage={canManage}
      internalUsers={(internalUsers ?? []) as Array<{ id: string; name: string }>}
      franchisePartners={(franchisePartners ?? []) as Array<{ id: string; name: string }>}
      referrals={referrals}
    />
  )
}
