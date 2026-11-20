import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/user'
import { decideAuthorization } from '@/app/actions/oauth-consent'
import loginStyles from '../../login/page.module.css'
import styles from './consent.module.css'

/**
 * The OAuth consent screen for Supabase Auth's OAuth server (set as the "Authorization path" in
 * Supabase → Authentication → OAuth Server). Claude or ChatGPT sends the person here to approve it
 * acting as them through /api/mcp.
 *
 * Not a public route: the proxy sends a signed-out visitor to /login with this URL as `next`, and
 * login returns them here — so the pending authorization survives signing in.
 */
export const dynamic = 'force-dynamic'

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>
}) {
  const { authorization_id: authorizationId } = await searchParams

  if (!authorizationId) {
    return <Shell><p className={loginStyles.subheading}>This link is missing its sign-in request. Start connecting again from Claude or ChatGPT.</p></Shell>
  }

  const user = await getUser()
  if (!user) {
    // Signed in to Supabase but not an approved Ecosystem user (or not signed in at all).
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`)
  }
  if (user.role === 'franchise_partner' || user.role === 'super_admin') {
    return <Shell><p className={loginStyles.subheading}>Connecting an AI assistant is available to the ESV team only.</p></Shell>
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !data) {
    return <Shell><p className={loginStyles.subheading}>This sign-in request has expired or was already used. Start connecting again from Claude or ChatGPT.</p></Shell>
  }
  // Already approved before for these scopes — Supabase hands back the redirect straight away.
  if (!('authorization_id' in data)) redirect(data.redirect_url)

  const clientName = data.client.name || 'An application'

  return (
    <Shell>
      <h1 className={loginStyles.heading}>Connect {clientName}</h1>
      <p className={loginStyles.subheading}>
        {clientName} is asking to use Ecosystem as <strong>{user.name || user.email}</strong>.
      </p>

      <ul className={styles.list}>
        <li>It can do what <em>you</em> can do in Ecosystem, and nothing more: same role, same data.</li>
        <li>Right now that means reading your tasks and company profiles, creating tasks for yourself,
          marking tasks done and commenting.</li>
        <li>It asks you before it changes anything. You can disconnect at any time from {clientName}&apos;s settings.</li>
      </ul>

      <form action={decideAuthorization} className={styles.actions}>
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button type="submit" name="decision" value="deny" className={styles.denyBtn}>Cancel</button>
        <button type="submit" name="decision" value="approve" className={loginStyles.submitBtn}>Allow</button>
      </form>

      {data.redirect_uri && (
        <p className={styles.fine}>You&apos;ll be sent back to {new URL(data.redirect_uri).host}.</p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={loginStyles.page}>
      <div className={loginStyles.card}>
        <div className={loginStyles.logoBlock}>
          <img className={loginStyles.brandLogoLight} src="/brand/ecosystem-logo.png" alt="Ecosystem" width={260} height={68} />
          <img className={loginStyles.brandLogoDark} src="/brand/ecosystem-logo-dark.png" alt="" aria-hidden="true" width={260} height={68} />
        </div>
        {children}
      </div>
    </div>
  )
}
