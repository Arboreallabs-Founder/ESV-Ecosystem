import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { mcpAuth } from '@/lib/mcp/context'

export async function createClient() {
  // Inside an /api/mcp request: act as the person whose OAuth token this is. See lib/mcp/context.ts.
  const mcp = mcpAuth.getStore()
  if (mcp) return createTokenClient(mcp.token)

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie setting is handled by proxy
          }
        },
      },
    }
  )
}

/**
 * A client that authenticates as the holder of `token` (a Supabase-issued access token).
 *
 * Same client type as the cookie path, so callers can't tell the difference:
 *  - Every PostgREST/storage request sends the token, so RLS sees that user.
 *  - auth.getClaims() / auth.getUser() — what the guards use — verify that token, because there is
 *    no cookie session for them to read. Verification is real: getClaims checks the JWT signature.
 */
function createTokenClient(token: string) {
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )
  const auth = client.auth
  const getClaims = auth.getClaims.bind(auth)
  const getUser = auth.getUser.bind(auth)
  auth.getClaims = ((jwt?: string, options?: Parameters<typeof getClaims>[1]) =>
    getClaims(jwt ?? token, options)) as typeof auth.getClaims
  auth.getUser = ((jwt?: string) => getUser(jwt ?? token)) as typeof auth.getUser
  return client
}
