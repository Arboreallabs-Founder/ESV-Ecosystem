import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPendingLeaveRequests, fetchRecentLeaveDecisions } from '@/lib/leave-requests'
import { fetchPendingExpenseRequests, fetchRecentExpenseDecisions } from '@/lib/expense-requests'
import ApprovalsView from './_components/ApprovalsView'

export default async function ApprovalsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'hr'].includes(user.role ?? '')) redirect('/hr')

  const [pendingLeave, pendingExpense, recentLeave, recentExpense] = await Promise.all([
    fetchPendingLeaveRequests(),
    fetchPendingExpenseRequests(),
    fetchRecentLeaveDecisions(),
    fetchRecentExpenseDecisions(),
  ])

  return (
    <ApprovalsView
      pendingLeave={pendingLeave}
      pendingExpense={pendingExpense}
      recentLeave={recentLeave}
      recentExpense={recentExpense}
    />
  )
}
