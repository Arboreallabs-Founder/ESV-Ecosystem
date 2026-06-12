import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { UserRow } from '@/lib/types'

/**
 * Fetches the current authenticated user's row from the `users` table.
 * Wrapped in React cache() — deduplicated within a single server render tree,
 * so layout + page calling this in the same request only hit the DB once.
 */
export const getUser = cache(async (): Promise<UserRow | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('id, name, role, email, franchise_partner_id')
    .eq('id', user.id)
    .single()
  return data ?? null
})
