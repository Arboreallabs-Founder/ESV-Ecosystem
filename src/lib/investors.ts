import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Investor } from './types'

export const fetchAllInvestors = cache(async (): Promise<Investor[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('investors')
    .select(`
      id, name, country, website, sectors, service_type,
      esv_poc_id, ticket_size_min, ticket_size_max, stage,
      referred_by_partner_id, created_by, created_at,
      esv_poc:users!esv_poc_id(name),
      esv_pocs:investor_poc_users(user:users(id, name)),
      referred_by_partner:franchise_partners!referred_by_partner_id(name),
      contacts:investor_contacts(
        id, investor_id, name, role, linkedin_url, linkedin_status,
        phone, email, sort_order, created_at
      )
    `)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row: any) => ({
    ...row,
    sectors: row.sectors ?? [],
    esv_poc: Array.isArray(row.esv_poc) ? (row.esv_poc[0] ?? null) : (row.esv_poc ?? null),
    esv_pocs: (row.esv_pocs ?? []).map((p: any) => {
      const user = Array.isArray(p.user) ? p.user[0] : p.user
      return { id: user?.id, name: user?.name }
    }).filter((p: any) => p.id),
    referred_by_partner: Array.isArray(row.referred_by_partner)
      ? (row.referred_by_partner[0] ?? null)
      : (row.referred_by_partner ?? null),
    contacts: (row.contacts ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  })) as Investor[]
})
