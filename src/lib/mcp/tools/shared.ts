import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { userFacingMessage } from '@/lib/action-errors'

/**
 * Helpers shared by every tool module.
 *
 * Rules every tool follows:
 *  - Permissions come from the same guards and RLS as the web app. A tool never uses a service key
 *    and never checks a role the app doesn't; if the person can't do it in the browser, it fails.
 *  - Writes go through the existing server actions, so validation, notifications, revalidation and
 *    stage automations are the app's own. Reads may query directly, but only through the caller's
 *    RLS-bound client (from a guard).
 *  - Every write is logged by the activity_events triggers, tagged as made via the connector
 *    (see lib/supabase/server.ts → createTokenClient).
 *  - Write tools return the record as it is after the change, so the assistant can confirm it.
 *  - Errors carry only text we wrote (UserFacingError) — never a raw Postgres message.
 */

export const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']

export function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
}

/** A refusal the assistant can act on ("stage_id does not belong to this pipeline"). */
export function refuse(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

export function fail(err: unknown): CallToolResult {
  const known = userFacingMessage(err)
  if (known) return refuse(known)
  if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
    return refuse(`${err.message}: your Ecosystem role does not allow this.`)
  }
  console.error('[mcp] tool failed:', err)
  return refuse('Something went wrong in Ecosystem. If it keeps happening, tell an admin.')
}

/** Wraps a handler so every tool logs its outcome and returns errors in one shape. */
export function run<A>(name: string, fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      const result = await fn(args)
      console.info(`[mcp] ${name} ${result.isError ? 'refused' : 'ok'}`)
      return result
    } catch (err) {
      console.info(`[mcp] ${name} failed`)
      return fail(err)
    }
  }
}

// ─── Input schemas ─────────────────────────────────────────────────────────
export const uuid = z.string().uuid()
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date.')
/** Rupees. Non-negative, finite, and below ₹10 lakh crore — anything bigger is a typo. */
export const inr = z.number().finite().min(0, 'Amounts cannot be negative.').max(1e13, 'That amount is too large; amounts are in rupees.')
export const shortText = (max = 200) => z.string().trim().max(max)
export const pageArgs = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).max(100000).default(0),
}

/** One embedded row from PostgREST, which may arrive as an object or a one-element array. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

/** { field: { before, after } } for every key in `keys` whose value changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) {
  const out: Record<string, { before: unknown; after: unknown }> = {}
  for (const k of keys) {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) out[k] = { before: before[k] ?? null, after: after[k] ?? null }
  }
  return out
}
