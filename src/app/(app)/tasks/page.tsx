import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { fetchAllUsers } from '@/lib/partners'
import { fetchCompanyOptions } from '@/lib/companies'
import { fetchDeskDealOptions } from '@/lib/deal-desk'
import TaskBoard from './_components/TaskBoard'

export default async function TasksPage() {
  const [user, tasks, users, companyOptions, dealOptions] = await Promise.all([
    getUser(),
    fetchAllTasks(),
    fetchAllUsers(),
    fetchCompanyOptions(),
    fetchDeskDealOptions(),
  ])
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  return (
    <TaskBoard
      tasks={tasks}
      users={users}
      companyOptions={companyOptions}
      dealOptions={dealOptions}
      currentUserId={user.id}
      userRole={user.role}
    />
  )
}
