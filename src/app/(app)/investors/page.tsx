import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllInvestors } from '@/lib/investors'
import { createClient } from '@/lib/supabase/server'
import InvestorGrid from './_components/InvestorGrid'

export default async function InvestorsPage() {
  const [user, investors] = await Promise.all([getUser(), fetchAllInvestors()])
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const supabase = await createClient()
  const [{ data: internalUsers }, { data: franchisePartners }] = await Promise.all([
    supabase.from('users').select('id, name').in('role', ['founder', 'admin', 'associate']).order('name'),
    ['founder', 'admin'].includes(user.role)
      ? supabase.from('franchise_partners').select('id, name').order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <InvestorGrid
      investors={investors}
      userRole={user.role ?? 'associate'}
      internalUsers={(internalUsers ?? []) as Array<{ id: string; name: string }>}
      franchisePartners={(franchisePartners ?? []) as Array<{ id: string; name: string }>}
    />
  )
}
