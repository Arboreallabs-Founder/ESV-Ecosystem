import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'

export default async function RootPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  if (user.role === 'franchise_partner') {
    redirect('/portal')
  } else if (user.role === 'associate') {
    redirect('/pipelines')
  } else {
    redirect('/dashboard')
  }
}
