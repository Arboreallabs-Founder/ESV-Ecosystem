import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveDeals, fetchCategories } from '@/lib/active-deals'
import ActiveDealsList from './_components/ActiveDealsList'

export default async function ActiveDealsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!userData || !['founder', 'admin', 'associate'].includes(userData.role)) redirect('/login')

  const [deals, categories] = await Promise.all([fetchActiveDeals(), fetchCategories()])
  return <ActiveDealsList deals={deals} categories={categories} />
}
