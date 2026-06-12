import { createClient } from '@/lib/supabase/server'

/**
 * Shared auth guard for server actions and server components.
 *
 * Verifies the caller's JWT locally via getClaims() (ES256 signature checked
 * against the cached project JWKS — no Auth-server round-trip), then checks
 * the caller's role from the `users` table. The role SELECT runs under RLS
 * with the same JWT, which PostgREST independently re-verifies, so a forged
 * token can never pass this guard.
 *
 * Throws 'Unauthorized' (no valid session) or 'Forbidden' (role not allowed).
 */
export async function requireRole(roles: string[]) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) throw new Error('Unauthorized')
  const { data: row } = await supabase.from('users').select('role').eq('id', userId).single()
  if (!row || !roles.includes(row.role)) throw new Error('Forbidden')
  return { supabase, userId, role: row.role as string }
}

/**
 * Lightweight variant for guards that only need an authenticated user id
 * (no role restriction). JWT is signature-verified locally as above.
 */
export async function requireAuth() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) throw new Error('Unauthorized')
  return { supabase, userId }
}
