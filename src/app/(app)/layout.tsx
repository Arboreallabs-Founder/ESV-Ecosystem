import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchUnreadNotificationCount } from '@/lib/notifications'
import { fetchClockSettings, fetchTodaysBirthdays } from '@/lib/hr-clock'
import AppShell from '@/app/_components/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const store = await cookies()
  const demoMode = store.get('demo_mode')?.value === '1' && user.email === 'demo@aalabs-demo.com'
  const demoPersona = store.get('demo_persona')?.value ?? 'founder'

  // Narrowed to founder/admin/hr only — associate/general lost clock-widget visibility
  // when the 'hr' role was introduced.
  const canSeeHrClock = ['founder', 'admin', 'hr'].includes(user.role ?? '')

  // In flight together. This layout renders before every page in the app, and these three were
  // awaited one after another — three sequential round trips to ap-south-1 on every single
  // navigation, before the page's own data had even been asked for.
  //
  // The bell asks for a count and nothing else: every role has notifications (an escalation can be
  // addressed to a partner), and the list itself is only fetched once somebody opens the panel.
  const [unreadCount, clockSettings, birthdaysToday] = await Promise.all([
    fetchUnreadNotificationCount(),
    canSeeHrClock ? fetchClockSettings() : Promise.resolve(null),
    canSeeHrClock ? fetchTodaysBirthdays() : Promise.resolve([]),
  ])

  return (
    <AppShell
      user={user}
      demoMode={demoMode}
      demoPersona={demoPersona}
      unreadCount={unreadCount}
      clockSettings={clockSettings}
      birthdaysToday={birthdaysToday}
    >
      {children}
    </AppShell>
  )
}
