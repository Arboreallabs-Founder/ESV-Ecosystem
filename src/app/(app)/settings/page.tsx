import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <SettingsClient
      name={user.name}
      email={user.email}
      role={user.role}
    />
  )
}
