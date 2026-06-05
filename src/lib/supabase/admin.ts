import { createClient } from '@supabase/supabase-js'

// Server-only admin client — uses service role key, never runs in browser.
// Required for public form submissions (unauthenticated visitors).
// Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never NEXT_PUBLIC_).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
