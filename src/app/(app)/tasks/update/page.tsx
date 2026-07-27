import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchActiveDeals } from '@/lib/active-deals'
import { fetchAllUsers } from '@/lib/partners'
import WeeklyUpdateClient from './_components/WeeklyUpdateClient'

export default async function TasksUpdatePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'general', 'hr'].includes(user.role ?? '')) redirect('/tasks')

  const [tasks, activeDeals, users] = await Promise.all([
    fetchAllTasks(),
    fetchActiveDeals(),
    fetchAllUsers(),
  ])

  return (
    <WeeklyUpdateClient
      tasks={tasks}
      activeDeals={activeDeals}
      users={users}
      currentUserId={user.id}
      currentUserRole={user.role ?? ''}
    />
  )
}
