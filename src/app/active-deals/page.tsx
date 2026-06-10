import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveDeals, fetchCategories } from '@/lib/active-deals'
import AppShell from '@/app/_components/AppShell'
import ActiveDealsList from './_components/ActiveDealsList'

export default async function ActiveDealsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: userRow } = await supabase.from('users').select('name, role, email').eq('id', user.id).single()
  if (!userRow || !['founder', 'admin', 'associate'].includes(userRow.role ?? '')) redirect('/login')

  const [deals, categories] = await Promise.all([fetchActiveDeals(), fetchCategories()])
  return (
    <AppShell user={userRow}>
      <ActiveDealsList deals={deals} categories={categories} />
    </AppShell>
  )
}
