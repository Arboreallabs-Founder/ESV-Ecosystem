/**
 * Turning a thrown error into something a person can act on.
 *
 * A founder tried to create a task and got a browser alert reading
 * `UnrecognizedActionError: Server Action "405b79…" was not found on the server`, followed by a
 * link to the Next.js docs. Nothing in that sentence tells them what to do, and the thing to do
 * was simply "reload".
 *
 * That error is deployment skew, not a bug in the task code. Server Action IDs are content-hashed
 * per build, so a tab opened before a deploy posts an ID the new server has never heard of. It
 * gets more likely the more often we ship, which is why it surfaced on a day with a dozen deploys.
 */

import { userFacingMessage } from './action-errors'

export type DescribedError = {
  /** What to show the user. */
  message: string
  /** True when the page is running against an older deployment and a reload fixes it. */
  stale: boolean
}

const STALE_MARKERS = [
  'was not found on the server',
  'unrecognizedactionerror',
  'failed to find server action',
  // Chunk loading failures have the same cause: the old build's assets are gone.
  'loading chunk',
  'chunkloaderror',
  'failed to fetch dynamically imported module',
]

export function describeError(err: unknown): DescribedError {
  // A refusal we wrote, carried across the server boundary in the digest because React strips the
  // message. Checked first: it is the answer whenever it is present, and it is already written for
  // a person, so none of the cleanup below applies to it.
  const deliberate = userFacingMessage(err)
  if (deliberate) return { stale: false, message: deliberate }

  const raw = err instanceof Error ? err.message : String(err)
  const hay = raw.toLowerCase()

  if (STALE_MARKERS.some((m) => hay.includes(m))) {
    return {
      stale: true,
      message:
        'The app was updated while this page was open, so this action could not be sent. '
        + 'Reload the page and try again — nothing was saved, so you will not create a duplicate.',
    }
  }

  // Server actions throw plain Errors with messages written for people; those pass through.
  // Anything that still looks like a stack trace or an object gets a generic sentence instead of
  // being shown raw.
  if (!raw || raw === '[object Object]' || raw.startsWith('{') || raw.includes('    at ')) {
    return { stale: false, message: 'Something went wrong. Please try again, or tell us what you were doing.' }
  }
  return { stale: false, message: raw.replace(/^Error:\s*/i, '') }
}

/**
 * Report an error to the user.
 *
 * Still an alert — replacing 45 call sites with inline error UI is a bigger change than this
 * deserves — but a readable one, and a stale deployment offers the reload rather than describing
 * it and leaving them to work it out.
 */
export function alertError(err: unknown): void {
  const { message, stale } = describeError(err)
  if (stale && typeof window !== 'undefined') {
    if (window.confirm(`${message}\n\nReload now?`)) {
      window.location.reload()
      return
    }
    return
  }
  if (typeof window !== 'undefined') window.alert(message)
}
