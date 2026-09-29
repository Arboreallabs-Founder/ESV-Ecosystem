import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchActiveDeals } from '@/lib/active-deals'
import { fetchAllUsers } from '@/lib/partners'
import { fetchLatestDealUpdates, fetchLatestTaskComments, fetchWeekTodos } from '@/lib/weekly-update'
import { fetchDayPlansBetween } from '@/lib/day-plans'
import { istDate } from '@/lib/ist-date'
import { fetchAutomaticTasks } from '@/lib/automatic-tasks'
import { fetchMandateHealth } from '@/lib/fundraise'
import { fetchProjects } from '@/lib/projects'
import WeeklyUpdateClient from './_components/WeeklyUpdateClient'

export default async function TasksUpdatePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/tasks')

  // A window rather than the selected week: the page lets you page back through weeks client-side,
  // and refetching on every arrow press would be a round trip for data this small.
  const [tasks, activeDeals, users, dealUpdates, weekTodos, dayPlans, automaticTasks, mandateHealth, projects, taskComments] = await Promise.all([
    fetchAllTasks(),
    fetchActiveDeals(),
    fetchAllUsers(),
    fetchLatestDealUpdates(),
    fetchWeekTodos(),
    fetchDayPlansBetween(istDate(-70), istDate(7)),
    // Brought up to date as a side effect of reading them — there is no scheduler, and a stale
    // list is how someone concludes the feature does not work.
    fetchAutomaticTasks(),
    fetchMandateHealth(),
    // Each person's projects and where they stand. A failed read shows the update without them
    // rather than failing the whole page.
    fetchProjects().catch((e) => { console.error('[weekly-update] projects read failed:', e); return [] }),
    fetchLatestTaskComments(),
  ])

  return (
    <WeeklyUpdateClient
      tasks={tasks}
      activeDeals={activeDeals}
      users={users}
      dealUpdates={dealUpdates}
      weekTodos={weekTodos}
      dayPlans={dayPlans}
      currentUserId={user.id}
      currentUserRole={user.role ?? ''}
      automaticTasks={automaticTasks}
      mandateHealth={mandateHealth}
      projects={projects}
      taskComments={taskComments}
    />
  )
}
