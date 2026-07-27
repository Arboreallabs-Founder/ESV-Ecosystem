import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchHrPolicies } from '@/lib/hr-zone'
import { fetchClockSettings, fetchAllBirthdays } from '@/lib/hr-clock'
import { fetchMyLeaveRequests, fetchPendingLeaveRequests } from '@/lib/leave-requests'
import { fetchMyExpenseRequests, fetchPendingExpenseRequests } from '@/lib/expense-requests'
import HrZoneView from './_components/HrZoneView'

export default async function HrZonePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const showClockAdmin = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  const canEditPolicies = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  const canDeletePolicies = ['founder', 'admin'].includes(user.role ?? '')
  const isApprover = ['founder', 'admin', 'hr'].includes(user.role ?? '')

  const [policies, clockSettings, birthdays, myLeaveRequests, myExpenseRequests, pendingLeave, pendingExpense] = await Promise.all([
    fetchHrPolicies(),
    showClockAdmin ? fetchClockSettings() : Promise.resolve(null),
    showClockAdmin ? fetchAllBirthdays() : Promise.resolve([]),
    fetchMyLeaveRequests(user.id),
    fetchMyExpenseRequests(user.id),
    isApprover ? fetchPendingLeaveRequests() : Promise.resolve([]),
    isApprover ? fetchPendingExpenseRequests() : Promise.resolve([]),
  ])

  return (
    <HrZoneView
      policies={policies}
      clockSettings={clockSettings}
      birthdays={birthdays}
      canEditPolicies={canEditPolicies}
      canDeletePolicies={canDeletePolicies}
      showClockAdmin={showClockAdmin}
      isApprover={isApprover}
      pendingApprovalsCount={pendingLeave.length + pendingExpense.length}
      myLeaveRequests={myLeaveRequests}
      myExpenseRequests={myExpenseRequests}
      orgId={user.org_id ?? ''}
      userId={user.id}
    />
  )
}
