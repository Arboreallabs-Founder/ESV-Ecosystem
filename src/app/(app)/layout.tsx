import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import AppShell from '@/app/_components/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')
  return <AppShell user={user}>{children}</AppShell>
}
