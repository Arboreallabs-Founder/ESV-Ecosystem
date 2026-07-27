import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchMyOpenTaskAlerts } from '@/lib/tasks'
import { fetchClockSettings, fetchTodaysBirthdays } from '@/lib/hr-clock'
import AppShell from '@/app/_components/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const store = await cookies()
  const demoMode = store.get('demo_mode')?.value === '1' && user.email === 'demo@aalabs-demo.com'
  const demoPersona = store.get('demo_persona')?.value ?? 'founder'

  const canHaveTasks = ['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')
  const myTaskAlerts = canHaveTasks ? await fetchMyOpenTaskAlerts(user.id) : []

  // Narrowed to founder/admin/hr only — associate/general lost clock-widget visibility
  // when the 'hr' role was introduced.
  const canSeeHrClock = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  const clockSettings = canSeeHrClock ? await fetchClockSettings() : null
  const birthdaysToday = canSeeHrClock ? await fetchTodaysBirthdays() : []

  return (
    <AppShell
      user={user}
      demoMode={demoMode}
      demoPersona={demoPersona}
      myTaskAlerts={myTaskAlerts}
      clockSettings={clockSettings}
      birthdaysToday={birthdaysToday}
    >
      {children}
    </AppShell>
  )
}
