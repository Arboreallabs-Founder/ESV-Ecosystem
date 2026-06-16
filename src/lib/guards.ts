import { createClient } from '@/lib/supabase/server'

export async function requireRole(roles: string[]) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) throw new Error('Unauthorized')
  const { data: row } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', userId)
    .single()
  if (!row || !roles.includes(row.role)) throw new Error('Forbidden')
  return { supabase, userId, role: row.role as string, orgId: row.org_id as string | null }
}

export async function requireAuth() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) throw new Error('Unauthorized')
  const { data: row } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', userId)
    .single()
  return { supabase, userId, orgId: row?.org_id as string | null }
}

export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) throw new Error('Unauthorized')
  const { data: row } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  if (!row || row.role !== 'super_admin') throw new Error('Forbidden')
  return { supabase, userId }
}
