import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DeskAssociateSummary, DeskDeal, DeskDealAction, DeskDealMedia } from '@/lib/types'

const BUCKET = 'deal-desk'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Batch-sign a set of object paths, returning a path → signed URL map.
async function signPaths(supabase: SupabaseServer, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return map
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_TTL)
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl)
  }
  return map
}

// Shape a raw desk_deals row (with embedded media/actions/associate) into a DeskDeal,
// filling signed URLs from the provided map.
function shapeDeal(row: any, signed: Map<string, string>): DeskDeal {
  const associate = Array.isArray(row.associate) ? row.associate[0] : row.associate
  const media: DeskDealMedia[] = (row.media ?? [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((m: any) => ({ ...m, signed_url: signed.get(m.url) }))
  const actions: DeskDealAction[] = (row.actions ?? [])
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((a: any) => {
      const createdByUser = Array.isArray(a.created_by_user) ? a.created_by_user[0] : a.created_by_user
      return {
        ...a,
        created_by_user: createdByUser ?? null,
        voice_note_signed_url: a.voice_note_url ? signed.get(a.voice_note_url) : undefined,
      }
    })
  return {
    ...row,
    associate: associate ?? null,
    revenue_data: row.revenue_data ?? [],
    founders: row.founders ?? [],
    cap_table_notable_names: row.cap_table_notable_names ?? [],
    media,
    actions,
  }
}

const DEAL_SELECT = `
  *,
  associate:users!associate_id(name),
  media:desk_deal_media(*),
  actions:desk_deal_actions(*, created_by_user:users!created_by(name))
`

/**
 * Reviewer roster: authors in the org plus their unseen/seen/starred deal counts.
 * Associates always appear; admins appear only once they've authored a card (admins are
 * primarily reviewers). RLS restricts this to founders/admins.
 */
export const fetchDeskAssociates = cache(async (): Promise<DeskAssociateSummary[]> => {
  const supabase = await createClient()
  const [{ data: users }, { data: deals }] = await Promise.all([
    supabase.from('users').select('id, name, role, photo_url').in('role', ['associate', 'admin']).order('name'),
    supabase.from('desk_deals').select('associate_id, seen_status, starred'),
  ])
  const roleById = new Map<string, string>()
  const summaries = new Map<string, DeskAssociateSummary>()
  for (const u of users ?? []) {
    roleById.set(u.id, u.role)
    summaries.set(u.id, { id: u.id, name: u.name ?? 'Unknown', photo_url: u.photo_url ?? null, unseen_count: 0, seen_count: 0, starred_count: 0 })
  }
  for (const d of deals ?? []) {
    const s = summaries.get(d.associate_id)
    if (!s) continue
    if (d.seen_status) s.seen_count++
    else s.unseen_count++
    if (d.starred) s.starred_count++
  }
  // Drop admins who haven't authored anything so the roster stays focused on people with cards.
  return [...summaries.values()].filter(
    (s) => roleById.get(s.id) === 'associate' || s.seen_count + s.unseen_count > 0,
  )
})

/**
 * Deals visible to the caller, newest first. RLS scopes automatically (reviewers see all,
 * associates see only their own); reviewers pass `associateId` to focus one person's feed.
 * Media and voice-note paths are resolved to signed URLs for display.
 */
export const fetchDeskDeals = cache(async (associateId?: string): Promise<DeskDeal[]> => {
  const supabase = await createClient()
  let query = supabase.from('desk_deals').select(DEAL_SELECT).order('created_at', { ascending: false })
  if (associateId) query = query.eq('associate_id', associateId)
  const { data } = await query
  if (!data) return []

  const paths: string[] = []
  for (const row of data as any[]) {
    for (const m of row.media ?? []) if (m.url) paths.push(m.url)
    for (const a of row.actions ?? []) if (a.voice_note_url) paths.push(a.voice_note_url)
  }
  const signed = await signPaths(supabase, paths)
  return (data as any[]).map((row) => shapeDeal(row, signed))
})

// Lightweight options for a "link deal" picker (id + name). RLS scopes automatically.
export const fetchDeskDealOptions = cache(async (): Promise<Array<{ id: string; name: string }>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('desk_deals').select('id, company_name').order('company_name')
  return ((data as Array<{ id: string; company_name: string }>) ?? []).map((d) => ({ id: d.id, name: d.company_name }))
})

/** Single deal detail with media + action thread. */
export const fetchDeskDeal = cache(async (id: string): Promise<DeskDeal | null> => {
  const supabase = await createClient()
  const { data } = await supabase.from('desk_deals').select(DEAL_SELECT).eq('id', id).single()
  if (!data) return null
  const paths: string[] = []
  for (const m of (data as any).media ?? []) if (m.url) paths.push(m.url)
  for (const a of (data as any).actions ?? []) if (a.voice_note_url) paths.push(a.voice_note_url)
  const signed = await signPaths(supabase, paths)
  return shapeDeal(data, signed)
})

/** Name of one associate (for the per-associate feed header when the caller is a reviewer). */
export const fetchAssociateName = cache(async (id: string): Promise<string | null> => {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('name').eq('id', id).single()
  return data?.name ?? null
})
