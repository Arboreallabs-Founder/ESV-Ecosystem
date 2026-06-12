import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/_components/AppShell'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  return (
    <AppShell user={userRow ?? { name: user.email, role: 'associate', email: user.email ?? '' }}>
      <SettingsClient
        name={userRow?.name ?? user.email ?? ''}
        email={userRow?.email ?? user.email ?? ''}
        role={userRow?.role ?? 'associate'}
      />
    </AppShell>
  )
}
