import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * The OAuth access token of the person whose AI assistant is calling /api/mcp, for the duration of
 * that one request — plus which assistant it is, for the activity log.
 *
 * Why a request-scoped store rather than threading a client through: every server action reaches
 * Supabase through `createClient()` (directly or via the guards), and that reads the session from
 * cookies. An MCP request has no cookies — it carries `Authorization: Bearer <token>`. With the
 * token here, `createClient()` builds a client for that person instead, so the MCP tools call the
 * exact same actions, guards and RLS as the web app. No business rule is duplicated, and nothing
 * the assistant does can exceed what that person could do in the browser.
 */
export const mcpAuth = new AsyncLocalStorage<{ token: string; client: string }>()

/** A short name for the calling app, from its User-Agent, falling back to the OAuth client id. */
export function connectorClientName(userAgent: string | null, clientId: string | null | undefined): string {
  const ua = (userAgent ?? '').toLowerCase()
  if (ua.includes('claude') || ua.includes('anthropic')) return 'Claude'
  if (ua.includes('openai') || ua.includes('chatgpt')) return 'ChatGPT'
  return clientId ? `client ${String(clientId).slice(0, 8)}` : 'unknown'
}
