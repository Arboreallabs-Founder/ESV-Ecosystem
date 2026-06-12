import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchCategories } from '@/lib/active-deals'
import CategoriesManager from './_components/CategoriesManager'

export default async function CategoriesPage() {
  const [user, categories] = await Promise.all([getUser(), fetchCategories()])
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  return <CategoriesManager initialCategories={categories} />
}
