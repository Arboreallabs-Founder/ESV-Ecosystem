import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/* Reads for the Deal Book (20261124000000). */

export const DEAL_BOOK_BUCKET = 'deal-book'
export const DESIGN_SLOTS = ['cover', 'about', 'contents', 'back'] as const
export type DesignSlot = typeof DESIGN_SLOTS[number]

export type DealBookIm = {
  active_deal_id: string
  named_path: string | null
  noname_path: string | null
  codename: string | null
  updated_at: string
}

export type DealBookRow = {
  active_deal_id: string
  title: string
  im: DealBookIm | null
  /** Position in the book, or null when the deal isn't in it. */
  position: number | null
}

export type DealBookSettings = Record<`${DesignSlot}_path`, string | null> & { updated_at: string | null }

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/**
 * Every deal marked Active, with its IM files and whether (and where) it's in the book. Dormant,
 * closed and archived deals are left out, so one that goes dormant drops out of the book and its
 * downloads without anyone having to remove it.
 */
export const fetchDealBook = cache(async (): Promise<{ rows: DealBookRow[]; settings: DealBookSettings }> => {
  const supabase = await createClient()
  const [deals, ims, items, settings] = await Promise.all([
    supabase.from('active_deals')
      .select('id, deal_state, entry:pipeline_entries!pipeline_entry_id(title, company:companies!company_id(name))')
      .eq('deal_state', 'active'),
    supabase.from('deal_book_ims').select('active_deal_id, named_path, noname_path, codename, updated_at'),
    supabase.from('deal_book_items').select('active_deal_id, position'),
    supabase.from('deal_book_settings').select('cover_path, about_path, contents_path, back_path, updated_at').maybeSingle(),
  ])
  const err = deals.error ?? ims.error ?? items.error ?? settings.error
  if (err) throw new Error(`Could not load the Deal Book: ${err.message}`)

  const imByDeal = new Map((ims.data ?? []).map((i) => [i.active_deal_id as string, i as DealBookIm]))
  const posByDeal = new Map((items.data ?? []).map((i) => [i.active_deal_id as string, i.position as number]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: DealBookRow[] = ((deals.data ?? []) as any[]).map((d) => {
    const entry = one(d.entry) as { title: string | null; company: { name: string } | { name: string }[] | null } | null
    const company = one(entry?.company ?? null)
    return {
      active_deal_id: d.id,
      title: company?.name ?? entry?.title ?? 'Untitled deal',
      im: imByDeal.get(d.id) ?? null,
      position: posByDeal.has(d.id) ? posByDeal.get(d.id)! : null,
    }
  })
  rows.sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.title.localeCompare(b.title))

  const s = settings.data as Partial<DealBookSettings> | null
  return {
    rows,
    settings: {
      cover_path: s?.cover_path ?? null,
      about_path: s?.about_path ?? null,
      contents_path: s?.contents_path ?? null,
      back_path: s?.back_path ?? null,
      updated_at: s?.updated_at ?? null,
    },
  }
})

/** One deal's IM files, for the panel on the deal page. Null when there are none (or before the migration). */
export const fetchDealIm = cache(async (activeDealId: string): Promise<DealBookIm | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('deal_book_ims')
    .select('active_deal_id, named_path, noname_path, codename, updated_at')
    .eq('active_deal_id', activeDealId).maybeSingle()
  if (error) {
    console.error('[deal-book] IM read failed:', error.message)
    return null
  }
  return (data as DealBookIm | null) ?? null
})

/** Whether a deal is switched on to show in the book (it still needs to be Active to appear). */
export const fetchInDealBook = cache(async (activeDealId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('deal_book_items')
    .select('active_deal_id').eq('active_deal_id', activeDealId).maybeSingle()
  if (error) {
    console.error('[deal-book] membership read failed:', error.message)
    return false
  }
  return !!data
})
