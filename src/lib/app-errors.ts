import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type AppErrorEntry = {
  id: string
  user_name: string | null
  user_role: string | null
  step: string
  code: string | null
  message: string | null
  details: string | null
  hint: string | null
  page: string | null
  created_at: string
}

/** The latest recorded database failures (app_error_log, 20261106000000). RLS returns rows to
    admins only; anyone else, or a database without the table yet, gets an empty list. */
export const fetchAppErrors = cache(async (): Promise<AppErrorEntry[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_error_log')
    .select('id, user_name, user_role, step, code, message, details, hint, page, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[app-errors] read failed:', error.message)
    return []
  }
  return (data ?? []) as AppErrorEntry[]
})
