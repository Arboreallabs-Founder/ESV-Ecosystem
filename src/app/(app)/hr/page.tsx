import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchHrPolicies } from '@/lib/hr-zone'
import { fetchClockSettings, fetchAllBirthdays } from '@/lib/hr-clock'
import { fetchMyLeaveRequests, fetchPendingLeaveRequests } from '@/lib/leave-requests'
import { fetchMyExpenseRequests, fetchPendingExpenseRequests } from '@/lib/expense-requests'
import { fetchMyLeaveBalances } from '@/lib/leave-balances'
import { fetchEmployeeRoster, fetchCompensationHistory } from '@/lib/employees'
import { fetchAllUsers } from '@/lib/partners'
import { fetchDocumentTypes, fetchIssuableCodes, fetchIssuedDocuments } from '@/lib/documents/catalogue'
import { TEMPLATES } from '@/lib/documents/templates'
import HrZoneView from './_components/HrZoneView'

export default async function HrZonePage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const showClockAdmin = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  const canEditPolicies = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  const canDeletePolicies = ['founder', 'admin'].includes(user.role ?? '')
  const isApprover = ['founder', 'admin', 'hr'].includes(user.role ?? '')
  // People and compensation are the same tier as the clock admin — founder/admin/HR.
  const canManagePeople = ['founder', 'admin', 'hr'].includes(user.role ?? '')

  const [policies, clockSettings, birthdays, myLeaveRequests, myExpenseRequests, pendingLeave, pendingExpense, myLeaveBalances, roster, allUsers, documentTypes, issuableCodes, issuedDocuments] = await Promise.all([
    fetchHrPolicies(),
    showClockAdmin ? fetchClockSettings() : Promise.resolve(null),
    showClockAdmin ? fetchAllBirthdays() : Promise.resolve([]),
    fetchMyLeaveRequests(user.id),
    fetchMyExpenseRequests(user.id),
    isApprover ? fetchPendingLeaveRequests() : Promise.resolve([]),
    isApprover ? fetchPendingExpenseRequests() : Promise.resolve([]),
    fetchMyLeaveBalances(user.id),
    canManagePeople ? fetchEmployeeRoster() : Promise.resolve([]),
    canManagePeople ? fetchAllUsers() : Promise.resolve([]),
    canManagePeople ? fetchDocumentTypes() : Promise.resolve([]),
    canManagePeople ? fetchIssuableCodes(user.role ?? '') : Promise.resolve(new Set<string>()),
    canManagePeople ? fetchIssuedDocuments() : Promise.resolve([]),
  ])

  // The field specs travel to the client as plain data — the templates themselves render PDFs on
  // the server and must never be bundled for the browser.
  const templateFields = Object.fromEntries(
    Object.entries(TEMPLATES).map(([code, tpl]) => [code, tpl.fields ?? []]),
  )

  // One history per person, fetched in parallel. RLS returns [] for anyone not permitted, so this
  // needs no separate permission branch beyond not asking at all when nobody can read it.
  const compensation: Record<string, import('@/lib/types').EmployeeCompensation[]> = {}
  if (canManagePeople) {
    const histories = await Promise.all(roster.map((r) => fetchCompensationHistory(r.user.id)))
    roster.forEach((r, i) => { compensation[r.user.id] = histories[i] })
  }

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
      roster={roster}
      compensation={compensation}
      canManagePeople={canManagePeople}
      managers={allUsers}
      documentTypes={documentTypes}
      issuableCodes={[...issuableCodes]}
      issuedDocuments={issuedDocuments}
      templateFields={templateFields}
      currentUserId={user.id}
      myLeaveRequests={myLeaveRequests}
      myExpenseRequests={myExpenseRequests}
      myLeaveBalances={myLeaveBalances}
      orgId={user.org_id ?? ''}
      userId={user.id}
    />
  )
}
