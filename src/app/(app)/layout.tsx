import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchMyOpenTaskAlerts } from '@/lib/tasks'
import AppShell from '@/app/_components/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const store = await cookies()
  const demoMode = store.get('demo_mode')?.value === '1' && user.email === 'demo@aalabs-demo.com'
  const demoPersona = store.get('demo_persona')?.value ?? 'founder'

  const canHaveTasks = ['founder', 'admin', 'associate'].includes(user.role ?? '')
  const myTaskAlerts = canHaveTasks ? await fetchMyOpenTaskAlerts(user.id) : []

  return (
    <AppShell user={user} demoMode={demoMode} demoPersona={demoPersona} myTaskAlerts={myTaskAlerts}>
      {children}
    </AppShell>
  )
}
