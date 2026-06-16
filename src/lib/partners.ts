import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ApprovedUser, FranchisePartner, PartnerUser, UserRow } from './types'

export const fetchPartnerUsers = cache(async (): Promise<PartnerUser[]> => {
  const supabase = await createClient()

  const [{ data: users }, { data: approved }] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, name, role, franchise_partner_id')
      .eq('role', 'franchise_partner')
      .order('name', { ascending: true }),
    supabase.from('approved_emails').select('email'),
  ])

  if (!users || users.length === 0) return []

  // Only return users who are in the approved_emails allowlist
  const approvedSet = new Set((approved ?? []).map((a) => a.email))
  const filteredUsers = users.filter((u) => approvedSet.has(u.email))

  if (filteredUsers.length === 0) return []

  const partnerIds = filteredUsers.map((u) => u.franchise_partner_id).filter(Boolean) as string[]

  let partnerMap: Record<string, FranchisePartner> = {}
  if (partnerIds.length > 0) {
    const { data: partners } = await supabase
      .from('franchise_partners')
      .select('*')
      .in('id', partnerIds)
    for (const p of partners ?? []) partnerMap[p.id] = p as FranchisePartner
  }

  return filteredUsers.map((u) => ({
    ...u,
    role: 'franchise_partner' as const,
    franchise_partners: u.franchise_partner_id ? (partnerMap[u.franchise_partner_id] ?? null) : null,
  }))
})

export const fetchAllUsers = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient()
  const [{ data }, { data: approved }] = await Promise.all([
    supabase.from('users').select('*').order('name', { ascending: true }),
    supabase.from('approved_emails').select('email'),
  ])
  const approvedSet = new Set((approved ?? []).map((a) => a.email))
  return ((data ?? []) as UserRow[]).filter((u) => approvedSet.has(u.email))
})

export const fetchApprovedUsers = cache(async (): Promise<ApprovedUser[]> => {
  const supabase = await createClient()

  const [{ data: approved }, { data: active }] = await Promise.all([
    supabase.from('approved_emails').select('email, name, role, added_at, org_id').order('added_at', { ascending: true }),
    supabase.from('users').select('id, email'),
  ])

  const activeByEmail = new Map((active ?? []).map((u) => [u.email, u.id]))

  return (approved ?? []).map((a) => ({
    email: a.email,
    name: a.name,
    role: a.role,
    added_at: a.added_at,
    org_id: a.org_id ?? null,
    userId: activeByEmail.get(a.email) ?? null,
    hasLoggedIn: activeByEmail.has(a.email),
  }))
})
