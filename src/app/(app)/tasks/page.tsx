import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchAllUsers } from '@/lib/partners'
import TaskBoard from './_components/TaskBoard'

export default async function TasksPage() {
  const [user, tasks, users] = await Promise.all([getUser(), fetchAllTasks(), fetchAllUsers()])
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  return (
    <TaskBoard
      tasks={tasks}
      users={users}
      currentUserId={user.id}
      userRole={user.role}
    />
  )
}
