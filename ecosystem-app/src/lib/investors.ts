import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Investor } from './types'

export const fetchAllInvestors = cache(async (): Promise<Investor[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investors')
    .select('*')
    .order('fund_name', { ascending: true })
  return (data ?? []) as Investor[]
})
