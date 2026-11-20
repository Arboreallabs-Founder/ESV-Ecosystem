import { createClient } from '@supabase/supabase-js'
import { STAGING, EMAILS, PASSWORD } from './env'

/** A staging access token for one seeded user — what an OAuth-connected assistant would hold. */
export async function tokenFor(role: keyof typeof EMAILS): Promise<string> {
  const sb = createClient(STAGING.url, STAGING.publishableKey, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAILS[role], password: PASSWORD })
  if (error || !data.session) throw new Error(`sign-in failed for ${role}: ${error?.message}`)
  return data.session.access_token
}

/** A Supabase client signed in as that user, for checking what the tools wrote. */
export async function dbAs(role: keyof typeof EMAILS) {
  const sb = createClient(STAGING.url, STAGING.publishableKey, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({ email: EMAILS[role], password: PASSWORD })
  if (error) throw error
  return sb
}

let rpcId = 0

/** One JSON-RPC call to /api/mcp, exactly as an MCP client sends it. */
export async function rpc(token: string, method: string, params: unknown = {}) {
  const res = await fetch(`${STAGING.appUrl}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'user-agent': 'Claude-User/integration-test',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const body = await res.json()
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`)
  return body.result
}

export type ToolResult = { isError: boolean; text: string; json: any } // eslint-disable-line @typescript-eslint/no-explicit-any

/** Call a tool; returns its text, parsed JSON (when it is JSON) and whether it was an error. */
export async function callTool(token: string, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const result = await rpc(token, 'tools/call', { name, arguments: args })
  const text: string = result.content?.[0]?.text ?? ''
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* plain-text result */ }
  return { isError: !!result.isError, text, json }
}
