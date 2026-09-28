import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllTasks } from '@/lib/tasks'
import { getMyTodos, getMyMentions } from '@/app/actions/personal-todos'
import { fetchMyDayPlans } from '@/lib/day-plans'
import { fetchAllUsers } from '@/lib/partners'
import { todayIst } from '@/lib/ist-date'
import MyTodosClient from './_components/MyTodosClient'

export default async function MyTodosPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const [todos, allTasks, dayPlans, mentions, allUsers] = await Promise.all([
    getMyTodos(),
    fetchAllTasks(),
    fetchMyDayPlans(user.id),
    getMyMentions(),
    fetchAllUsers(),
  ])
  const myTasks = allTasks.filter((t) => t.assignee_id === user.id)
  // The @mention picker offers everyone but yourself — mentioning yourself is just a note.
  const mentionable = allUsers.filter((u) => u.id !== user.id)

  // "Today" is resolved on the server in IST — the working timezone for everyone here — so a
  // browser in another zone cannot file a plan against the wrong day.
  return (
    <MyTodosClient
      todos={todos}
      myTasks={myTasks}
      dayPlans={dayPlans}
      mentions={mentions}
      mentionableUsers={mentionable}
      todayIso={todayIst()}
    />
  )
}
