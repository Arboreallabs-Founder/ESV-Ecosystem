import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DESK_STAGES } from '@/lib/types'
import type {
  DeskAssociateSummary, DeskDeal, DeskDealAction, DeskDealMedia,
  DeskDealStatus, DeskRoundStatus, DeskStage,
} from '@/lib/types'

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
  actions:desk_deal_actions(*, created_by_user:users!created_by(name, photo_url))
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

// ── Reviewer overview ────────────────────────────────────────────────────────
// Everything the Deal Desk landing page shows, derived from one light query. The full
// `fetchDeskDeals` select embeds media and actions and signs every storage path; none of that is
// needed to count deals, so the overview reads its own narrow set of columns instead.

export type DeskOverviewRow = {
  id: string
  company_name: string
  sector: string | null
  stage: DeskStage | null
  ask_inr: number | null
  deal_status: DeskDealStatus
  seen_status: boolean
  starred: boolean
  round_status: DeskRoundStatus | null
  call_date: string | null
  created_at: string
  updated_at: string
  associate_id: string
  associate_name: string
  associate_photo: string | null
}

export type DeskOverview = {
  rows: DeskOverviewRow[]
  total: number
  open: number
  discuss: number
  moreInfo: number
  rejected: number
  starred: number
  unseen: number
  totalAskInr: number
  addedThisMonth: number
  addedLastMonth: number
  byStage: Array<{ label: string; count: number }>
  /** Deals added per day over the trailing window, plus the running total on that day. */
  trend: Array<{ date: string; added: number; cumulative: number }>
  /** Unreviewed deals, longest-waiting first — the actual to-do on this page. */
  waiting: DeskOverviewRow[]
}

const TREND_DAYS = 30

function istDay(iso: string): string {
  // Bucket by IST calendar day, matching every other date the app shows.
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    .toISOString()
    .slice(0, 10)
}

export const fetchDeskOverview = cache(async (): Promise<DeskOverview> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('desk_deals')
    .select('id, company_name, sector, stage, ask_inr, deal_status, seen_status, starred, round_status, call_date, created_at, updated_at, associate_id, associate:users!associate_id(name, photo_url)')
    .order('updated_at', { ascending: false })

  // A failed read must not render as a page full of confident zeroes.
  if (error) {
    console.error('[deal-desk] overview read failed:', error.message)
  }

  const rows: DeskOverviewRow[] = ((data ?? []) as any[]).map((r) => {
    const a = Array.isArray(r.associate) ? r.associate[0] : r.associate
    return {
      id: r.id,
      company_name: r.company_name,
      sector: r.sector,
      stage: r.stage,
      ask_inr: r.ask_inr,
      deal_status: r.deal_status,
      seen_status: r.seen_status,
      starred: r.starred,
      round_status: r.round_status,
      call_date: r.call_date,
      created_at: r.created_at,
      updated_at: r.updated_at,
      associate_id: r.associate_id,
      associate_name: a?.name ?? 'Unknown',
      associate_photo: a?.photo_url ?? null,
    }
  })

  const count = (fn: (r: DeskOverviewRow) => boolean) => rows.filter(fn).length

  // Month boundaries in IST, so "this month" means what it means to the people using it.
  const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const thisMonth = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(nowIst.getFullYear(), nowIst.getMonth() - 1, 1)
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
  const monthOf = (r: DeskOverviewRow) => istDay(r.created_at).slice(0, 7)

  // Stage buckets follow DESK_STAGES order, not count order — these are ordered funding stages,
  // so sorting them by size would scramble the one thing the sequence tells you.
  const stageCounts = new Map<string, number>(DESK_STAGES.map((s) => [s as string, 0]))
  let unstaged = 0
  for (const r of rows) {
    if (r.stage && stageCounts.has(r.stage)) stageCounts.set(r.stage, stageCounts.get(r.stage)! + 1)
    else unstaged++
  }
  const byStage = [...stageCounts.entries()].map(([label, count]) => ({ label, count }))
  if (unstaged > 0) byStage.push({ label: 'Not set', count: unstaged })

  // Trend: one point per day across the window, including days with nothing, so the line's
  // horizontal spacing is time rather than "whenever something happened".
  const addedByDay = new Map<string, number>()
  for (const r of rows) {
    const d = istDay(r.created_at)
    addedByDay.set(d, (addedByDay.get(d) ?? 0) + 1)
  }
  const trend: DeskOverview['trend'] = []
  const start = new Date(nowIst)
  start.setDate(start.getDate() - (TREND_DAYS - 1))
  // Seed the running total with everything that predates the window.
  const startKey = start.toISOString().slice(0, 10)
  let cumulative = rows.filter((r) => istDay(r.created_at) < startKey).length
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const added = addedByDay.get(key) ?? 0
    cumulative += added
    trend.push({ date: key, added, cumulative })
  }

  return {
    rows,
    total: rows.length,
    open: count((r) => r.deal_status === 'open'),
    discuss: count((r) => r.deal_status === 'discuss'),
    moreInfo: count((r) => r.deal_status === 'more_info'),
    rejected: count((r) => r.deal_status === 'rejected'),
    starred: count((r) => r.starred),
    unseen: count((r) => !r.seen_status),
    totalAskInr: rows.reduce((sum, r) => sum + (r.ask_inr ?? 0), 0),
    addedThisMonth: count((r) => monthOf(r) === thisMonth),
    addedLastMonth: count((r) => monthOf(r) === lastMonth),
    byStage,
    trend,
    waiting: rows
      .filter((r) => !r.seen_status)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 6),
  }
})
