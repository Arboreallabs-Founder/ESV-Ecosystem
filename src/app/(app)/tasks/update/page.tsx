import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchActiveDeals } from '@/lib/active-deals'
import { fetchAllUsers } from '@/lib/partners'
import { fetchLatestDealUpdates, fetchWeekTodos } from '@/lib/weekly-update'
import WeeklyUpdateClient from './_components/WeeklyUpdateClient'

export default async function TasksUpdatePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/tasks')

  const [tasks, activeDeals, users, dealUpdates, weekTodos] = await Promise.all([
    fetchAllTasks(),
    fetchActiveDeals(),
    fetchAllUsers(),
    fetchLatestDealUpdates(),
    fetchWeekTodos(),
  ])

  return (
    <WeeklyUpdateClient
      tasks={tasks}
      activeDeals={activeDeals}
      users={users}
      dealUpdates={dealUpdates}
      weekTodos={weekTodos}
      currentUserId={user.id}
      currentUserRole={user.role ?? ''}
    />
  )
}
