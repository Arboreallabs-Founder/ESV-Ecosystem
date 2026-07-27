import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { getMyTodos } from '@/app/actions/personal-todos'
import MyTodosClient from './_components/MyTodosClient'

export default async function MyTodosPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const [todos, allTasks] = await Promise.all([getMyTodos(), fetchAllTasks()])
  const myTasks = allTasks.filter((t) => t.assignee_id === user.id)

  return <MyTodosClient todos={todos} myTasks={myTasks} />
}
