import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Investor, FundOutreach } from './types'

export const fetchAllInvestors = cache(async (): Promise<Investor[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investors')
    .select('*')
    .order('fund_name', { ascending: true })
  return (data ?? []) as Investor[]
})

export const fetchDealOutreach = cache(async (dealId: string): Promise<FundOutreach[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_outreach')
    .select('*, investor:investor_id(*)')
    .eq('deal_id', dealId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as unknown as FundOutreach[]
})
