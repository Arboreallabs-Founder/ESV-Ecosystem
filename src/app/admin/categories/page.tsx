import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCategories } from '@/lib/active-deals'
import CategoriesManager from './_components/CategoriesManager'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!userData || !['founder', 'admin'].includes(userData.role)) redirect('/dashboard')

  const categories = await fetchCategories()
  return <CategoriesManager initialCategories={categories} />
}
