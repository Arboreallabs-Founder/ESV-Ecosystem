import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchRecurringTasks } from '@/lib/recurring-tasks'
import { fetchAllUsers } from '@/lib/partners'
import RecurringTasksView from './_components/RecurringTasksView'

export default async function RecurringTasksPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/dashboard')

  const isAdmin = ['founder', 'admin'].includes(user.role ?? '')
  const [tasks, users] = await Promise.all([
    fetchRecurringTasks(),
    isAdmin ? fetchAllUsers() : Promise.resolve([]),
  ])

  return <RecurringTasksView tasks={tasks} users={users} isAdmin={isAdmin} />
}
