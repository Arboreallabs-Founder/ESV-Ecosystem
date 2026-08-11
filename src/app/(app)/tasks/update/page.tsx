import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchActiveDeals } from '@/lib/active-deals'
import { fetchAllUsers } from '@/lib/partners'
import { fetchLatestDealUpdates, fetchWeekTodos } from '@/lib/weekly-update'
import { fetchAutomaticTasks } from '@/lib/automatic-tasks'
import { fetchMandateHealth } from '@/lib/fundraise'
import WeeklyUpdateClient from './_components/WeeklyUpdateClient'

export default async function TasksUpdatePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/tasks')

  const [tasks, activeDeals, users, dealUpdates, weekTodos, automaticTasks, mandateHealth] = await Promise.all([
    fetchAllTasks(),
    fetchActiveDeals(),
    fetchAllUsers(),
    fetchLatestDealUpdates(),
    fetchWeekTodos(),
    // Brought up to date as a side effect of reading them — there is no scheduler, and a stale
    // list is how someone concludes the feature does not work.
    fetchAutomaticTasks(),
    fetchMandateHealth(),
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
      automaticTasks={automaticTasks}
      mandateHealth={mandateHealth}
    />
  )
}
