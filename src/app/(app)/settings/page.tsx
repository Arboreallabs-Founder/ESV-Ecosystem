import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEmployeeProfile } from '@/lib/employees'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  // Own row is always readable — the employee_profiles SELECT policy allows user_id = auth.uid().
  const profile = await fetchEmployeeProfile(user.id)

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
      profile={profile}
    />
  )
}
