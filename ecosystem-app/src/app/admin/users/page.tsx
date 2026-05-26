import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchAllUsers } from '@/lib/partners'
import AppShell from '@/app/_components/AppShell'
import UsersTable from './_components/UsersTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') redirect('/dashboard')

  const users = await fetchAllUsers()

  return (
    <AppShell user={userData ?? { name: user.email, role: 'admin', email: user.email }}>
      <UsersTable users={users} currentUserId={user.id} />
    </AppShell>
  )
}
