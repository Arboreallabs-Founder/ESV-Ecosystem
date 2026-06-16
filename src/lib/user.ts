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
    .select('id, name, role, email, franchise_partner_id, org_id')
    .eq('id', userId)
    .single()
  return data ?? null
})
