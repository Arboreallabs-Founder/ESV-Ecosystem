import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchAllInvestors } from '@/lib/investors'
import AppShell from '@/app/_components/AppShell'
import InvestorTable from './_components/InvestorTable'

export default async function InvestorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'franchise_partner') redirect('/portal')

  const investors = await fetchAllInvestors()

  return (
    <AppShell user={userData ?? { name: user.email, role: 'associate', email: user.email }}>
      <InvestorTable
        investors={investors}
        userRole={userData?.role ?? 'associate'}
      />
    </AppShell>
  )
}
