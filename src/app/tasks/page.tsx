import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchAllUsers } from '@/lib/partners'
import AppShell from '@/app/_components/AppShell'
import TaskBoard from './_components/TaskBoard'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'franchise_partner') redirect('/portal')

  const [tasks, users] = await Promise.all([
    fetchAllTasks(),
    fetchAllUsers(),
  ])

  return (
    <AppShell user={userData ?? { name: user.email, role: 'associate', email: user.email }}>
      <TaskBoard
        tasks={tasks}
        users={users}
        currentUserId={user.id}
        userRole={userData?.role ?? 'associate'}
      />
    </AppShell>
  )
}
