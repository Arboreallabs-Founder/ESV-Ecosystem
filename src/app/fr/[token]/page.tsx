import { createClient } from '@/lib/supabase/server'
import FundraisePublicClient from './_components/FundraisePublicClient'

/**
 * What the founder sees.
 *
 * No account: the token is the key, and a SECURITY DEFINER function decides exactly how much it
 * buys — the major status of each fund, the updates we marked as theirs, and any rejection reason.
 * Never the internal timeline.
 */
export default async function FundraisePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_fundraise_public', { p_token: token })

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Link not available</h1>
          <p style={{ color: '#666', fontSize: '0.9375rem', lineHeight: 1.55 }}>
            This link has either been withdrawn or is not shared yet. Ask Earlyseed Ventures for a
            current one.
          </p>
        </div>
      </div>
    )
  }

  // Recorded once, on the first open, so we know it landed.
  await supabase.rpc('mark_fundraise_viewed', { p_token: token })

  return <FundraisePublicClient data={data as never} token={token} />
}
