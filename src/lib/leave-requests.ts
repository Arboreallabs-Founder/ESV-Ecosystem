import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { LeaveRequest } from './types'

const LEAVE_SELECT = '*, requester:requester_id(name, email), decided_by_user:decided_by(name)'

export const fetchMyLeaveRequests = cache(async (userId: string): Promise<LeaveRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as LeaveRequest[]
})

export const fetchPendingLeaveRequests = cache(async (): Promise<LeaveRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as LeaveRequest[]
})

export const fetchRecentLeaveDecisions = cache(async (): Promise<LeaveRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .neq('status', 'pending')
    .order('decided_at', { ascending: false })
    .limit(30)
  return (data ?? []) as unknown as LeaveRequest[]
})
