'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { mirrorImage } from '@/lib/image-cache'
import { UserFacingError } from '@/lib/action-errors'

/**
 * Filling in fund logos in bulk.
 *
 * 248 funds have a usable domain and 28 have a logo. Doing that by hand is a day of copying image
 * addresses, so this derives one from the domain each fund already has on file.
 *
 * ─── Where the image comes from ────────────────────────────────────────────
 * Google's favicon service, at sz=256. Measured against real fund domains rather than assumed:
 * it answered for 12 of 12 where DuckDuckGo managed 7 and scraping the page itself managed 8 —
 * blume.vc returns 403 to a server-side fetch, chiratae.com declares nothing at all.
 *
 * Scraping og:image was the tempting alternative because the files are bigger, but bigger is the
 * wrong measure: og:image is a social share card, so accel.com hands back a 60KB banner. A banner
 * in a square logo slot looks like a mistake. A favicon is the mark itself, already square.
 *
 * ─── Why small ones are skipped ────────────────────────────────────────────
 * Three of those twelve only publish a 16 or 32 pixel icon. Stretched to the 40px a card draws, a
 * 16px favicon looks worse than the initials already shown in its place — so anything under 64px
 * is left alone rather than made to look broken. Better no logo than a blurry one.
 */

const MIN_PIXELS = 64

/** The bare domain, from whatever is in the website field — some rows hold "blume.vc", some a URL. */
function domainOf(website: string | null): string | null {
  const raw = (website ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./i, '')
    // A hostname with no dot is not a domain; those rows hold a company name or a note.
    return host.includes('.') ? host : null
  } catch { return null }
}

/**
 * PNG and ICO dimensions, straight off the header.
 *
 * Enough to answer "is this big enough to display" without pulling in an image library for what is
 * a sixteen-byte read. Google returns PNG for everything measured; ICO is handled because a couple
 * of sources still serve one and its header is two bytes.
 */
function pixelWidth(buf: Uint8Array): number {
  // PNG: 8-byte signature, then IHDR whose width sits at offset 16 big-endian.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19]
  }
  // ICO: width of the first entry, at offset 6. Zero means 256 by the format's own convention.
  if (buf.length > 8 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return buf[6] === 0 ? 256 : buf[6]
  }
  // Anything else (SVG, WebP, JPEG) is assumed fine — none of those are produced by a 16px favicon.
  return 9999
}

export type LogoSweepResult = {
  updated: number
  tooSmall: number
  failed: number
  remaining: number
  /** Named so a run is reviewable rather than a number that went up. */
  done: string[]
}

/**
 * One batch.
 *
 * Batched because 248 network round trips do not fit in a Server Action's budget, and a single
 * request that dies at the timeout leaves no record of how far it got. The caller loops until
 * `remaining` is zero, so progress is visible and a failure costs one batch rather than the lot.
 */
export async function fetchFundLogos(batchSize = 12): Promise<LogoSweepResult> {
  const { supabase, orgId, role } = await requireRole(['founder', 'admin'])
  if (!orgId) throw new UserFacingError('No organisation in scope.')
  if (!['founder', 'admin'].includes(role)) {
    throw new UserFacingError('Only a founder or admin can import logos.')
  }

  const { data: rows } = await supabase
    .from('investors')
    .select('id, name, website')
    .is('logo_url', null)
    .not('website', 'is', null)
    .neq('service_type', 'angel_investor')
    .order('name')
    .limit(400)

  const candidates = ((rows ?? []) as Array<{ id: string; name: string; website: string | null }>)
    .map((r) => ({ ...r, domain: domainOf(r.website) }))
    .filter((r) => r.domain)

  const batch = candidates.slice(0, Math.max(1, Math.min(batchSize, 25)))
  const out: LogoSweepResult = {
    updated: 0, tooSmall: 0, failed: 0,
    remaining: Math.max(0, candidates.length - batch.length),
    done: [],
  }

  for (const c of batch) {
    const source = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(c.domain!)}&sz=256`
    try {
      const probe = await fetch(source, { signal: AbortSignal.timeout(10_000) })
      if (!probe.ok) { out.failed++; continue }
      const bytes = new Uint8Array(await probe.arrayBuffer())
      if (pixelWidth(bytes) < MIN_PIXELS) { out.tooSmall++; continue }

      // Mirrored rather than hotlinked, like every other image here: a third-party URL works today
      // and 404s later, and this one would also make every card render depend on Google.
      const { publicUrl } = await mirrorImage(supabase, source, 'cached-images', `investors/${c.id}/logo`)
      const { error } = await supabase.from('investors').update({ logo_url: publicUrl }).eq('id', c.id)
      if (error) { out.failed++; continue }
      out.updated++
      out.done.push(c.name)
    } catch {
      // One unreachable domain must not end the batch — it is recorded and the run carries on.
      out.failed++
    }
  }

  if (out.updated > 0) {
    revalidatePath('/investors')
    revalidatePath('/active-deals')
  }
  return out
}

/** How much is left to do, so the button can say so before anyone commits to a run. */
export async function countFundsMissingLogos(): Promise<number> {
  const { supabase } = await requireRole(['founder', 'admin'])
  const { data } = await supabase
    .from('investors')
    .select('website')
    .is('logo_url', null)
    .not('website', 'is', null)
    .neq('service_type', 'angel_investor')
    .limit(1000)
  return ((data ?? []) as Array<{ website: string | null }>)
    .filter((r) => domainOf(r.website)).length
}

export type LogoCsvResult = {
  updated: number
  skipped: number
  failed: Array<{ name: string; why: string }>
  remaining: number
}

/**
 * Set logos from a pasted CSV.
 *
 * Matched on `id`, not on name. Name matching is what the existing investor importer does and it is
 * the wrong choice here: the book holds eighteen duplicate name groups, so "Blume" and "Blume
 * Ventures" would compete for one row and whichever lost would silently take the other's logo.
 *
 * Every address is mirrored into our bucket rather than stored as given. A pasted URL from a fund's
 * own site works today and 404s after their next redesign, and this is exactly the rot the mirror
 * exists to stop -- the same reason a logo saved one at a time is mirrored too.
 *
 * Batched for the same reason as the sweep above: a hundred fetches do not fit in one request.
 */
export async function importLogosFromCsv(csv: string, offset = 0, batchSize = 12): Promise<LogoCsvResult> {
  const { supabase } = await requireRole(['founder', 'admin'])

  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new UserFacingError('That CSV has a header but no rows.')

  // Strip the byte-order mark Excel writes back, or the first column name never matches.
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim().toLowerCase())
  const idCol = header.indexOf('id')
  const logoCol = header.indexOf('logo_url')
  if (idCol === -1 || logoCol === -1) {
    throw new UserFacingError('The CSV needs an "id" column and a "logo_url" column. Export a fresh one and fill in the logo_url column.')
  }

  /** Enough CSV to survive a fund name with a comma in it, which Excel will have quoted. */
  const cells = (line: string): string[] => {
    const out: string[] = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') quoted = false
        else cur += c
      } else if (c === '"') quoted = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }

  const rows = lines.slice(1).map(cells)
  const batch = rows.slice(offset, offset + Math.max(1, Math.min(batchSize, 25)))
  const out: LogoCsvResult = {
    updated: 0, skipped: 0, failed: [],
    remaining: Math.max(0, rows.length - (offset + batch.length)),
  }

  for (const r of batch) {
    const id = r[idCol]
    const url = (r[logoCol] ?? '').trim()
    if (!id) { out.skipped++; continue }
    // Blank means "I did not touch this row", not "remove the logo". Clearing one is a deliberate
    // act and belongs on the fund itself, not in a column somebody left alone.
    if (!url) { out.skipped++; continue }

    const { data: inv } = await supabase.from('investors').select('id, name').eq('id', id).maybeSingle()
    if (!inv) { out.failed.push({ name: id.slice(0, 8), why: 'no fund with that id' }); continue }
    const fund = inv as { id: string; name: string }

    try {
      const { publicUrl } = await mirrorImage(supabase, url, 'cached-images', `investors/${fund.id}/logo`)
      const { error } = await supabase.from('investors').update({ logo_url: publicUrl }).eq('id', fund.id)
      if (error) { out.failed.push({ name: fund.name, why: `could not save (code ${(error as { code?: string }).code ?? '?'})` }); continue }
      out.updated++
    } catch (err) {
      // The mirror's own refusals are already written for a person — an unreachable host, a link to
      // a web page rather than an image, a file over the size cap.
      out.failed.push({ name: fund.name, why: err instanceof Error ? err.message : 'could not fetch' })
    }
  }

  if (out.updated > 0) {
    revalidatePath('/investors')
    revalidatePath('/active-deals')
  }
  return out
}
