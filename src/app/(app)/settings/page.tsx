import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <SettingsClient
      userId={user.id}
      name={user.name}
      email={user.email}
      role={user.role}
      phone={user.phone}
      designation={user.designation}
      location={user.location}
      photoUrl={user.photo_url}
    />
  )
}
