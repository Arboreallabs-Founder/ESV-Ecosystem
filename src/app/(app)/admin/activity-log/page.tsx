import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchInvestorEditLog } from '@/lib/investors'
import { fetchHrPolicyEditLog } from '@/lib/hr-zone'
import { fetchEventEditLog } from '@/lib/events'
import type { ActivityLogEntry } from '@/lib/types'
import ActivityLogClient from './_components/ActivityLogClient'

export default async function ActivityLogPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  const [investorEdits, hrPolicyEdits, eventEdits] = await Promise.all([
    fetchInvestorEditLog(),
    fetchHrPolicyEditLog(),
    fetchEventEditLog(),
  ])

  const entries: ActivityLogEntry[] = [
    ...investorEdits.map((e): ActivityLogEntry => ({
      id: `investor-${e.id}`, entity_type: 'investor', entity_name: e.investor_name,
      edited_by_name: e.edited_by_name, action: 'updated', changes: e.changes, created_at: e.created_at,
    })),
    ...hrPolicyEdits.map((e): ActivityLogEntry => ({
      id: `hr_policy-${e.id}`, entity_type: 'hr_policy', entity_name: e.policy_title,
      edited_by_name: e.edited_by_name, action: e.action, changes: e.changes, created_at: e.created_at,
    })),
    ...eventEdits.map((e): ActivityLogEntry => ({
      id: `event-${e.id}`, entity_type: 'event', entity_name: e.event_title,
      edited_by_name: e.edited_by_name, action: e.action, changes: e.changes, created_at: e.created_at,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return <ActivityLogClient entries={entries} />
}
