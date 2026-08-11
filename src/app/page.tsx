import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'

export default async function RootPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  if (user.role === 'franchise_partner') {
    redirect('/my-companies')
  } else if (user.role === 'associate') {
    redirect('/pipelines')
  } else if (user.role === 'general' || user.role === 'hr') {
    redirect('/tasks')
  } else {
    redirect('/dashboard')
  }
}
