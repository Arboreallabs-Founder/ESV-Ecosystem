/**
 * Getting a deliberate refusal from a Server Action to the person who caused it.
 *
 * ─── The problem ───────────────────────────────────────────────────────────
 * React's Flight renderer replaces the message of every error crossing the server boundary with
 * "An error occurred in the Server Components render. The specific message is omitted in production
 * builds…". It is a good default — an unhandled Postgres error can name columns, constraints and
 * table structure — but it applies to the messages we wrote for people too. So every carefully
 * worded refusal in the 33 action files ("You can only edit events you created", "Two partners
 * claiming one relationship is a fee question") reached production users as that same sentence.
 * Somebody pasting an SVG logo URL saw it and had no way to learn that SVG was the problem.
 *
 * ─── Why the digest ────────────────────────────────────────────────────────
 * Next only computes a digest when the error does not already carry one:
 *
 *     if (err.digest) { …look it up… } else { err.digest = hash(message + stack) }
 *
 * and the client copies it onto the masked error verbatim. That is the same door notFound() and
 * redirect() go through. So an error that sets its own digest can carry a payload across a boundary
 * that strips everything else.
 *
 * ─── Why not return { error } instead ──────────────────────────────────────
 * That is the documented approach, and it is right for a form that renders its own field errors.
 * As a sweep across 254 actions it is the wrong trade: changing a return type from void to
 * { error?: string } does not make TypeScript flag the call sites that ignore it, so every one of
 * the 88 places that currently catch and display would silently start swallowing instead. A visible
 * unhelpful message is a worse bug than no message at all, and that conversion turns the first into
 * the second wherever it is applied incompletely.
 *
 * Throwing keeps the existing control flow exactly as it is. If a throw site is missed it keeps the
 * old masked behaviour — no worse than today, rather than silently lost.
 *
 * ─── The line this draws ───────────────────────────────────────────────────
 * Only messages we wrote travel. `throw error` — rethrowing a Postgres or Supabase error — is left
 * alone deliberately and stays masked, because those are the ones that leak schema detail. The
 * distinction is not incidental: it is the reason the masking exists, and this keeps it.
 */

/** Marks a digest as one of ours. Anything else is Next's own hash and stays opaque. */
const PREFIX = 'ESV_MSG;'

/**
 * An error whose message survives production.
 *
 * Use for refusals a person is meant to read and act on. Never for an unexpected failure, and never
 * for anything carrying a value from the database.
 */
export class UserFacingError extends Error {
  readonly digest: string

  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
    // Newlines would break the digest out of its own field on the wire; the messages are one or two
    // sentences, and a length cap keeps a stray interpolated value from bloating the payload.
    this.digest = PREFIX + message.replace(/\s+/g, ' ').trim().slice(0, 400)
  }
}

/**
 * Recover the message from an error that has crossed the boundary.
 *
 * Returns null when the error is not one of ours — a genuine failure, whose masked message is the
 * correct thing to show.
 */
export function userFacingMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const digest = (err as { digest?: unknown }).digest
  if (typeof digest !== 'string' || !digest.startsWith(PREFIX)) return null
  return digest.slice(PREFIX.length) || null
}
