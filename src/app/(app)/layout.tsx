import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import AppShell from '@/app/_components/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const store = await cookies()
  const demoMode = store.get('demo_mode')?.value === '1'
  const demoPersona = store.get('demo_persona')?.value ?? 'founder'

  return (
    <AppShell user={user} demoMode={demoMode} demoPersona={demoPersona}>
      {children}
    </AppShell>
  )
}
