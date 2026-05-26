import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { FranchisePartner, UserRow } from './types'

export const fetchAllPartners = cache(async (): Promise<FranchisePartner[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('franchise_partners')
    .select('*')
    .order('name', { ascending: true })
  return (data ?? []) as FranchisePartner[]
})

export const fetchAllUsers = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true })
  return (data ?? []) as UserRow[]
})
