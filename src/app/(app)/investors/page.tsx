import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllInvestors } from '@/lib/investors'
import { createClient } from '@/lib/supabase/server'
import InvestorGrid from './_components/InvestorGrid'

export default async function InvestorsPage() {
  const [user, investors] = await Promise.all([getUser(), fetchAllInvestors()])
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'franchise_partner', 'general'].includes(user.role ?? '')) redirect('/login')

  // Internal users manage everything; partners may add/edit their own referrals (POC stays locked).
  const isInternal = ['founder', 'admin', 'associate'].includes(user.role ?? '')
  const canManage = isInternal || user.role === 'franchise_partner'
  const supabase = await createClient()
  const [{ data: internalUsers }, { data: franchisePartners }] = await Promise.all([
    isInternal
      ? supabase.from('users').select('id, name').in('role', ['founder', 'admin', 'associate']).order('name')
      : Promise.resolve({ data: [] }),
    ['founder', 'admin'].includes(user.role ?? '')
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
    />
  )
}
