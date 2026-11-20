/**
 * Where to send someone after they sign in, from a `next` value that came off a URL or cookie.
 *
 * Only same-site paths are honoured. Anything that could leave the site — `//evil.com`, `/\evil.com`
 * (browsers treat the backslash as a slash), a full URL — is dropped, so the login page can't be
 * used as an open redirect.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (/[\r\n]/.test(value)) return null
  return value
}

/** Cookie that carries `next` across the Google OAuth round trip, which drops query strings. */
export const NEXT_COOKIE = 'post_login_next'
