import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { mcpAuth } from '@/lib/mcp/context'
import { protectedResourceMetadataUrl, publicOrigin } from '@/lib/mcp/oauth'
import { registerTools } from '@/lib/mcp/tools'

/**
 * The Ecosystem MCP server — what an employee's Claude or ChatGPT connects to.
 *
 * Stateless Streamable HTTP: every request builds a fresh server, so nothing is held between calls
 * (Vercel functions don't keep memory anyway) and no session can leak from one person to another.
 *
 * Auth: a missing or invalid token gets a 401 pointing at the protected-resource metadata, which
 * is what starts the assistant's sign-in flow. A valid token is a Supabase access token for one user; the
 * request then runs inside `mcpAuth`, so every createClient() — and so every guard, action and RLS
 * check — acts as that person. See lib/mcp/context.ts.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function unauthorized(req: Request, error?: 'invalid_token') {
  const params = [`resource_metadata="${protectedResourceMetadataUrl(publicOrigin(req))}"`]
  if (error) params.push(`error="${error}"`)
  return new Response(JSON.stringify({ error: error ?? 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': `Bearer ${params.join(', ')}` },
  })
}

async function verify(token: string): Promise<string | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
  // Checks the signature and expiry. Whether this user may do anything is decided later, per tool,
  // by the same guards the app uses (an unapproved account has no `users` row and is refused there).
  // getClaims throws, rather than returning an error, on a token that isn't a JWT at all — that is
  // still just "not authenticated", so it must be a 401 (which restarts sign-in), never a 500.
  try {
    const { data, error } = await supabase.auth.getClaims(token)
    if (error || !data?.claims?.sub) return null
    return data.claims.sub
  } catch {
    return null
  }
}

async function handle(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (!token) return unauthorized(req)

  const userId = await verify(token)
  if (!userId) return unauthorized(req, 'invalid_token')

  return mcpAuth.run({ token }, async () => {
    const server = new McpServer(
      { name: 'esv-ecosystem', title: 'ESV Ecosystem', version: '0.1.0' },
      {
        instructions:
          'Tools for Earlyseed Ventures\' Ecosystem app, acting as the signed-in employee with exactly ' +
          'their permissions. Use list_my_tasks / get_task before changing a task, and search_companies ' +
          'to find a company id. Confirm with the person before creating or changing anything.',
      },
    )
    registerTools(server)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    })
    await server.connect(transport)
    console.info(`[mcp] request user=${userId}`)
    return transport.handleRequest(req)
  })
}

export { handle as GET, handle as POST, handle as DELETE }
