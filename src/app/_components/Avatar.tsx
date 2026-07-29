/**
 * The one avatar in the app.
 *
 * Six components had grown their own `initials()` + `<img>` pairs with slightly different
 * fallbacks and sizes; this replaces them so a person looks the same everywhere they appear.
 *
 * Plain `<img>`, deliberately — `next/image` would route every avatar through Vercel's optimiser
 * and burn transformation quota for images that are already small, already square, and already
 * served from Supabase's CDN with a one-year cache-control (see src/lib/image-cache.ts).
 *
 * Not a client component: it has no state or handlers, so it renders on the server wherever it's
 * used from one, and still works inside client components.
 */

import styles from './Avatar.module.css'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

/** Initials from a name, falling back to an email local-part when the name is missing. */
export function personInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || ''
  if (!source) return '?'
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Avatar({
  name,
  email,
  photoUrl,
  size = 'sm',
  title,
  className = '',
}: {
  name?: string | null
  email?: string | null
  photoUrl?: string | null
  size?: AvatarSize
  /** Defaults to the name — set explicitly for things like "Priya (assignee)". */
  title?: string
  className?: string
}) {
  const label = title ?? name ?? email ?? undefined
  return (
    <span className={`${styles.avatar} ${styles[size]} ${className}`} title={label}>
      {photoUrl
        // alt is empty on purpose: the name is essentially always rendered next to the avatar,
        // so announcing it again just makes screen readers repeat themselves.
        ? <img src={photoUrl} alt="" loading="lazy" decoding="async" />
        : <span className={styles.initials}>{personInitials(name, email)}</span>}
    </span>
  )
}

/**
 * Overlapping stack for "who's on this", with an overflow count.
 * Reversed z-index so the leftmost face sits on top, which reads as a queue rather than a pile.
 */
export function AvatarGroup({
  people,
  size = 'sm',
  max = 4,
}: {
  people: Array<{ id?: string; name?: string | null; email?: string | null; photo_url?: string | null }>
  size?: AvatarSize
  max?: number
}) {
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length

  return (
    <span className={styles.group}>
      {shown.map((p, i) => (
        <span key={p.id ?? `${p.name}-${i}`} className={styles.groupItem} style={{ zIndex: shown.length - i }}>
          <Avatar name={p.name} email={p.email} photoUrl={p.photo_url} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`${styles.groupItem} ${styles.avatar} ${styles[size]} ${styles.overflow}`}
          title={people.slice(max).map((p) => p.name ?? p.email ?? 'Unknown').join(', ')}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
