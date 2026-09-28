/** The URL a team member should actually share: the readable /apply/<slug> when there is one,
    otherwise the token link. Kept apart from lib/associate-referrals.ts, which is server-only. */
export function referralPath(slug: string | null, token: string): string {
  return slug ? `/apply/${slug}` : `/f/${token}`
}

/** Normalises what someone types as their link name, or returns why it can't be one. Mirrors the
    form_links_slug_format constraint (20261011000000) so the refusal is a sentence, not a DB error. */
export function normaliseSlug(input: string): { slug: string } | { error: string } {
  const slug = input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (slug.length < 2) return { error: 'Use at least 2 letters or numbers.' }
  if (slug.length > 40) return { error: 'Keep it to 40 characters or fewer.' }
  return { slug }
}
