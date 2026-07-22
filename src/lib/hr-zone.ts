import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { HrPolicy, HrPolicyEditLogEntry } from './types'

export const fetchHrPolicies = cache(async (): Promise<HrPolicy[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('hr_policies')
    .select('*, created_by_user:created_by(name)')
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false })
  return (data ?? []) as unknown as HrPolicy[]
})

// Founder/admin-only audit trail of HR policy edits (RLS restricts the SELECT to those roles).
export const fetchHrPolicyEditLog = cache(async (): Promise<HrPolicyEditLogEntry[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('hr_policy_edit_log')
    .select('id, policy_id, policy_title, edited_by_name, action, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as HrPolicyEditLogEntry[]
})
