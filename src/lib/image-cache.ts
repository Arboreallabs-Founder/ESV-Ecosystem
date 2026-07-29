import type { SupabaseClient } from '@supabase/supabase-js'

/* Mirroring pasted image URLs into our own storage.

   Server-side only — `mirrorImage` is called from server actions and does an outbound fetch.
   It takes the Supabase client as an argument rather than importing @/lib/supabase/server, so
   nothing here pulls next/headers into a client bundle (see the /tasks/kpi build failure that
   taught us that lesson).

   The reason isn't Vercel cost — avatars render with plain <img>, so Next.js image optimisation
   is never invoked and no transformation quota is consumed. Adding next/image is what would
   create that bill; this deliberately doesn't.

   The reason is that third-party image URLs rot. LinkedIn and most social CDNs serve signed,
   time-limited media URLs: paste one and the avatar works today, then quietly 404s in a few
   weeks. Hotlinking also depends on the origin's referrer policy, which we don't control.

   Mirroring once at save time gives a permanent URL on Supabase's CDN, served with a long
   cache-control so repeat views never re-fetch. Bytes go browser → Supabase directly; the
   Next.js server is not in the path. */

/** 1 year. These objects are content-addressed by record id and overwritten in place on change. */
const CACHE_CONTROL = '31536000'

/** Generous for a headshot, small enough that a mistake can't fill the bucket. */
const MAX_BYTES = 5 * 1024 * 1024

/** A slow origin shouldn't hold a server action open. */
const FETCH_TIMEOUT_MS = 10_000

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
}

export class ImageCacheError extends Error {}

/**
 * Reject anything that isn't a public http(s) URL.
 *
 * The server is the one making this request, so a pasted URL is an SSRF vector: `http://localhost`
 * or a link-local address would have the server fetch something the paster can't reach themselves.
 * This is admin-gated, but the check costs nothing and the blast radius if it were ever exposed
 * more widely is large.
 */
function assertPublicHttpUrl(raw: string): URL {
  let url: URL
  try { url = new URL(raw) } catch { throw new ImageCacheError('That doesn\'t look like a valid URL.') }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageCacheError('Only http and https image links are supported.')
  }

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host === '0.0.0.0'
    || host === '[::1]'
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)              // link-local, incl. cloud metadata endpoints
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new ImageCacheError('That URL points at a private address.')
  }

  return url
}

export type MirrorResult = { publicUrl: string; bytes: number; contentType: string }

/**
 * Fetch `sourceUrl` and store it at `bucket/pathBase.<ext>`, returning a public URL.
 *
 * `pathBase` must NOT carry an extension — the real one is decided by the response's content
 * type, since a URL's apparent extension is frequently absent or wrong on CDN links.
 */
export async function mirrorImage(
  supabase: SupabaseClient,
  sourceUrl: string,
  bucket: string,
  pathBase: string,
): Promise<MirrorResult> {
  assertPublicHttpUrl(sourceUrl)

  let res: Response
  try {
    res = await fetch(sourceUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Some CDNs 403 a request with no UA. Identify honestly rather than spoofing a browser.
      headers: { 'user-agent': 'ESV-Ecosystem/1.0 (avatar cache)', accept: 'image/*' },
    })
  } catch {
    throw new ImageCacheError('Could not reach that image URL. Check the link and try again.')
  }

  if (!res.ok) {
    throw new ImageCacheError(`That image URL returned ${res.status}. It may have expired or be private.`)
  }

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ImageCacheError(
      contentType.startsWith('text/')
        ? 'That link points to a web page, not an image. Right-click the photo and copy the image address.'
        : `Unsupported image type${contentType ? ` (${contentType})` : ''}. Use JPG, PNG, WebP, GIF or AVIF.`,
    )
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength === 0) throw new ImageCacheError('That image is empty.')
  if (buffer.byteLength > MAX_BYTES) {
    throw new ImageCacheError(`That image is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`)
  }

  const path = `${pathBase}.${EXT_BY_TYPE[contentType]}`
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    cacheControl: CACHE_CONTROL,
    // Overwrite in place: one canonical object per record, so changing a photo doesn't
    // accumulate orphans nobody will ever clean up.
    upsert: true,
  })
  if (error) throw new ImageCacheError(`Could not save the image: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  // A cache-busting token: the path is stable across replacements, so without this a browser
  // that already cached the old bytes for a year would never see the new photo.
  const publicUrl = `${data.publicUrl}?v=${Date.now().toString(36)}`

  return { publicUrl, bytes: buffer.byteLength, contentType }
}

/** True for URLs we've already mirrored — re-mirroring our own copy would be pointless churn. */
export function isAlreadyCached(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes('/storage/v1/object/public/profile-photos/')
    || url.includes('/storage/v1/object/public/cached-images/')
}
