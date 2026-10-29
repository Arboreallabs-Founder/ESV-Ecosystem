import { after } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { setDbFailureReporter } from '@/lib/action-errors'

/*
 * Writes every database failure an action reports (dbFailure) to app_error_log, for admins to
 * troubleshoot from Admin > Activity Log > Errors (20261106000000).
 *
 * Server-only, and wired in by registration rather than imported by action-errors.ts: that module
 * is also loaded in the browser (client-errors reads its digests), so it can't import the server
 * Supabase client. guards.ts imports this file, and every action goes through a guard, so the
 * reporter is in place before any action can fail.
 *
 * after() runs the insert once the response has gone, so logging never slows the failing action
 * down and can never turn one error into two. Every step is wrapped: a logging failure is dropped.
 */
setDbFailureReporter((step, error) => {
  try {
    after(async () => {
      try {
        const e = (error ?? {}) as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
        let page: string | null = null
        try { page = (await headers()).get('referer') } catch { /* no request headers here */ }
        const supabase = await createClient()
        await supabase.rpc('log_app_error', {
          p_step: step,
          p_code: typeof e.code === 'string' ? e.code : null,
          p_message: typeof e.message === 'string' ? e.message : null,
          p_details: typeof e.details === 'string' ? e.details : null,
          p_hint: typeof e.hint === 'string' ? e.hint : null,
          p_page: page,
        })
      } catch { /* the log is a courtesy; never fail because of it */ }
    })
  } catch { /* after() outside a request scope: nothing to log against */ }
})
