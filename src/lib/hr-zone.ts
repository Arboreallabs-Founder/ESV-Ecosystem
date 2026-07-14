import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { HrPolicy } from './types'

export const fetchHrPolicies = cache(async (): Promise<HrPolicy[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('hr_policies')
    .select('*, created_by_user:created_by(name)')
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false })
  return (data ?? []) as unknown as HrPolicy[]
})
