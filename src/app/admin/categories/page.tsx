import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCategories } from '@/lib/active-deals'
import AppShell from '@/app/_components/AppShell'
import CategoriesManager from './_components/CategoriesManager'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: userRow } = await supabase.from('users').select('name, role, email').eq('id', user.id).single()
  if (!userRow || !['founder', 'admin'].includes(userRow.role ?? '')) redirect('/dashboard')

  const categories = await fetchCategories()
  return (
    <AppShell user={userRow}>
      <CategoriesManager initialCategories={categories} />
    </AppShell>
  )
}
