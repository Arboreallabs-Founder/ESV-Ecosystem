import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { UserRow } from '@/lib/types'

/**
 * Fetches the current authenticated user's row from the `users` table.
 *
 * Auth is verified via getClaims(): the ES256 JWT signature is checked locally
 * against the project JWKS (cached module-wide by auth-js), so no round-trip to
 * the Supabase Auth server is needed. The follow-up `users` SELECT runs under
 * RLS with the same JWT, which PostgREST independently re-verifies — a forged
 * token returns no row and the caller redirects to /login.
 *
 * Wrapped in React cache() — deduplicated within a single server render tree.
 */
export const getUser = cache(async (): Promise<UserRow | null> => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return null
  const { data } = await supabase
    .from('users')
    .select('id, name, role, email, franchise_partner_id, org_id, phone, designation, location, photo_url, is_external')
    .eq('id', userId)
    .single()
  return data ?? null
})

/**
 * Is this user a General Lead (20261105000000)? Read on its own rather than in getUser(): the
 * column arrives with a migration, and a select naming a missing column would fail every page.
 * Any error reads as "not a lead", which is the safe direction.
 */
export const isGeneralLead = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users').select('role, is_general_lead').eq('id', userId).maybeSingle()
  if (error || !data) return false
  const row = data as { role: string; is_general_lead?: boolean }
  return row.role === 'general' && !!row.is_general_lead
})
