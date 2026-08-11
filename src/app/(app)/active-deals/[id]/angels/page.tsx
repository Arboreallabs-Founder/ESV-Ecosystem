import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal } from '@/lib/active-deals'
import { fetchAngelLists, isSyndicateDeal } from '@/lib/angel-reachout'
import { fetchAssignableForSgp } from '@/lib/partner-companies'
import { createClient } from '@/lib/supabase/server'
import AngelReachoutClient from './_components/AngelReachoutClient'
import type { UserRow } from '@/lib/types'

/**
 * Angel Reachout — syndicate deals only, and internal only (§13).
 *
 * Gated on the deal's own categories rather than a separate flag: that is where the answer already
 * lives, and a second copy would drift the moment somebody retags a deal.
 */
export default async function AngelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/dashboard')

  const supabase = await createClient()
  const [deal, lists, syndicate, { data: teamRows }] = await Promise.all([
    fetchActiveDeal(id),
    fetchAngelLists(id),
    isSyndicateDeal(id),
    supabase.from('users').select('*')
      .in('role', ['founder', 'admin', 'associate']).order('name'),
  ])
  if (!deal) notFound()

  if (!syndicate) {
    return (
      <div style={{ padding: '2.5rem 0', maxWidth: '58ch' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Angel reachout is for syndicate deals
        </h1>
        <p style={{ color: 'var(--color-muted)', lineHeight: 1.65, fontSize: '0.9375rem' }}>
          This deal is not tagged Syndicate. Angel reachout works our own angel network, which is a
          different job from an investment-banking mandate — that one runs through the fundraise
          status list instead. Tag the deal Syndicate if it belongs here.
        </p>
      </div>
    )
  }

  return (
    <AngelReachoutClient
      lists={lists}
      dealId={id}
      dealName={deal.entry?.title ?? 'this deal'}
      team={(teamRows ?? []) as UserRow[]}
    />
  )
}
