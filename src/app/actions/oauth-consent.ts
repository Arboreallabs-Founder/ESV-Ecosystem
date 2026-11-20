'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserFacingError } from '@/lib/action-errors'

/**
 * Approve or deny a pending OAuth authorization (Claude asking to act as this person through
 * /api/mcp). Supabase Auth checks that the authorization belongs to the signed-in user; we only
 * relay the decision and send the browser back to the client with the code or the denial.
 */
export async function decideAuthorization(formData: FormData) {
  const authorizationId = String(formData.get('authorization_id') ?? '')
  const decision = formData.get('decision')
  if (!authorizationId) throw new UserFacingError('This sign-in request is missing its id. Start again from Claude.')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims.sub) throw new UserFacingError('Your session expired. Sign in and try again from Claude.')

  const { data, error } = decision === 'approve'
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })

  if (error || !data?.redirect_url) {
    console.error('[oauth] consent decision failed:', error?.message)
    throw new UserFacingError('This sign-in request has expired or was already used. Start again from Claude.')
  }
  redirect(data.redirect_url)
}
