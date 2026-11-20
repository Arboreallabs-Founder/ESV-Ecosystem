import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { mcpAuth, connectorClientName } from '@/lib/mcp/context'
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
const SERVER_INSTRUCTIONS = [
  "Tools for Earlyseed Ventures' Ecosystem app. You act as the signed-in employee with exactly their permissions; every change is logged as made through the AI connector.",
  'Confirm with the person before any create, update or stage move: say what will change, then call the tool.',
  'Tools:',
  '- Me & tasks: whoami, list_my_tasks, get_task, create_task (assignee_id to assign to someone; status Done + completed_at logs finished work), update_task (assignee_id reassigns), update_task_status, add_task_comment.',
  "- Team: list_people (find someone's id), team_activity (what a person or the team completed in a period — default this week — what they have open or overdue, and their pipeline moves and edits). What you can see about others follows the person's role.",
  '- Companies: search_companies, get_company, create_company (returns possible duplicates unless force=true), update_company, add_founder, update_founder, list_company_fields, set_company_field, create_company_field.',
  '- Pipelines (before a deal exists): list_pipelines, list_pipeline_entries, get_pipeline_entry, create_pipeline_entry, move_pipeline_entry (fires the stage automations, e.g. auto-tasks).',
  '- Deals (Active Deals, after acceptance): list_deals, get_deal, create_deal, update_deal.',
  'Look ids up first (list_people, search_companies, list_pipelines, list_deals); never guess them. If a name matches several people, ask which one. Amounts are in rupees (INR), as plain numbers.',
].join('\n')

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

async function verify(token: string): Promise<{ sub: string; clientId: string | null } | null> {
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
    const clientId = (data.claims as { client_id?: unknown }).client_id
    return { sub: data.claims.sub, clientId: typeof clientId === 'string' ? clientId : null }
  } catch {
    return null
  }
}

async function handle(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (!token) return unauthorized(req)

  const caller = await verify(token)
  if (!caller) return unauthorized(req, 'invalid_token')
  const client = connectorClientName(req.headers.get('user-agent'), caller.clientId)

  return mcpAuth.run({ token, client }, async () => {
    const server = new McpServer(
      { name: 'esv-ecosystem', title: 'ESV Ecosystem', version: '0.2.0' },
      { instructions: SERVER_INSTRUCTIONS },
    )
    registerTools(server)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    })
    await server.connect(transport)
    console.info(`[mcp] request user=${caller.sub} client=${client}`)
    return transport.handleRequest(req)
  })
}

export { handle as GET, handle as POST, handle as DELETE }
