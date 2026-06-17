import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchAllUsers } from '@/lib/partners'
import TaskKpiView from './_components/TaskKpiView'

export default async function TaskKpiPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const isAdmin = ['founder', 'admin'].includes(user.role)

  // RLS scopes tasks automatically: associates get only their own, founders/admins get all.
  const [tasks, users] = await Promise.all([
    fetchAllTasks(),
    isAdmin ? fetchAllUsers() : Promise.resolve([]),
  ])

  return (
    <TaskKpiView
      tasks={tasks}
      users={users}
      userRole={user.role}
      currentUserId={user.id}
    />
  )
}
