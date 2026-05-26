import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Deal, DealNote, DealDocument, StageHistoryEntry, DashboardStats } from './types'

export const fetchAllDeals = cache(async (): Promise<Deal[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as Deal[]
})

export const fetchDeal = cache(async (dealId: string): Promise<Deal | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single()
  return data as Deal | null
})

export const fetchDealNotes = cache(async (dealId: string): Promise<DealNote[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_notes')
    .select('id, deal_id, content, created_by, created_at, author:created_by(name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as DealNote[]
})

export const fetchDealDocuments = cache(async (dealId: string): Promise<DealDocument[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_documents')
    .select('*')
    .eq('deal_id', dealId)
    .order('uploaded_at', { ascending: false })
  return (data ?? []) as DealDocument[]
})

export const fetchDealHistory = cache(async (dealId: string): Promise<StageHistoryEntry[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_stage_history')
    .select('id, deal_id, from_stage, to_stage, changed_by, changed_at, changer:changed_by(name)')
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: false })
  return (data ?? []) as unknown as StageHistoryEntry[]
})

export const fetchDashboardStats = cache(async (): Promise<DashboardStats> => {
  const supabase = await createClient()

  const [activeRes, mandateRes, closedRes, activityRes] = await Promise.all([
    supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .neq('current_stage', 'Closed Success')
      .neq('current_stage', 'Closed Dead'),
    supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('current_stage', 'Mandate Accepted'),
    supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .in('current_stage', ['Closed Success', 'Closed Dead']),
    supabase
      .from('deal_stage_history')
      .select('id, from_stage, to_stage, changed_at, deal:deal_id(company_name), changer:changed_by(name)')
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  return {
    activeDeals: activeRes.count ?? 0,
    inMandate: mandateRes.count ?? 0,
    closedTotal: closedRes.count ?? 0,
    recentActivity: (activityRes.data ?? []) as unknown as DashboardStats['recentActivity'],
  }
})

export const fetchPartnerDeals = cache(async (franchisePartnerId: string): Promise<Deal[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('*')
    .eq('referring_partner_id', franchisePartnerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Deal[]
})
