import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseRequest } from './types'

const BUCKET = 'expenses'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Batch-sign a set of invoice object paths, returning a path → signed URL map — same pattern
// as src/lib/deal-desk.ts's signPaths(), since `expenses` is a private bucket too.
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

const EXPENSE_SELECT = '*, requester:requester_id(name, email, photo_url), decided_by_user:decided_by(name, photo_url)'

async function withSignedUrls(supabase: SupabaseServer, rows: ExpenseRequest[]): Promise<ExpenseRequest[]> {
  const signed = await signPaths(supabase, rows.map((r) => r.invoice_path))
  return rows.map((r) => ({ ...r, invoice_signed_url: signed.get(r.invoice_path) ?? null }))
}

export const fetchMyExpenseRequests = cache(async (userId: string): Promise<ExpenseRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('expense_requests')
    .select(EXPENSE_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
  return withSignedUrls(supabase, (data ?? []) as unknown as ExpenseRequest[])
})

export const fetchPendingExpenseRequests = cache(async (): Promise<ExpenseRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('expense_requests')
    .select(EXPENSE_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return withSignedUrls(supabase, (data ?? []) as unknown as ExpenseRequest[])
})

export const fetchRecentExpenseDecisions = cache(async (): Promise<ExpenseRequest[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('expense_requests')
    .select(EXPENSE_SELECT)
    .neq('status', 'pending')
    .order('decided_at', { ascending: false })
    .limit(30)
  return withSignedUrls(supabase, (data ?? []) as unknown as ExpenseRequest[])
})
