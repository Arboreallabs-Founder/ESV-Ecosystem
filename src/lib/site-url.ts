/**
 * The app's public base URL, with no trailing slash.
 *
 * One definition, because this string gets baked into things that outlive the process that made
 * them — QR codes people print, and verification footers rendered permanently into issued PDFs.
 * It previously existed as two copies of the same fallback in two files, which is exactly how a
 * wrong host ends up on half the artefacts and the right one on the other half.
 *
 * Set NEXT_PUBLIC_SITE_URL in the environment. The fallback is the production host rather than a
 * localhost guess: a QR code or a letter footer pointing at localhost is permanently useless to
 * whoever receives it, whereas one pointing at production is merely wrong in dev.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    || 'https://ecosystem.earlyseedventures.com')
}

/** Public share link for an intake form token. */
export function formShareUrl(token: string): string {
  return `${siteUrl()}/f/${token}`
}

/** Public verification page for an issued HR document. */
export function documentVerifyUrl(token: string): string {
  return `${siteUrl()}/verify/${token}`
}
