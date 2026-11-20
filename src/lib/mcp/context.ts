import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * The OAuth access token of the person whose Claude is calling /api/mcp, for the duration of that
 * one request.
 *
 * Why a request-scoped store rather than threading a client through: every server action reaches
 * Supabase through `createClient()` (directly or via the guards), and that reads the session from
 * cookies. An MCP request has no cookies — it carries `Authorization: Bearer <token>`. With the
 * token here, `createClient()` builds a client for that person instead, so the MCP tools call the
 * exact same actions, guards and RLS as the web app. No business rule is duplicated, and nothing
 * Claude does can exceed what that person could do in the browser.
 */
export const mcpAuth = new AsyncLocalStorage<{ token: string }>()
