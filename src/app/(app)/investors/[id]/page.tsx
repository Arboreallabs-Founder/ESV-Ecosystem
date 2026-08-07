import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchInvestor } from '@/lib/investors'
import { createClient } from '@/lib/supabase/server'
import InvestorProfile from './_components/InvestorProfile'

/**
 * An investor's own page: preferences, who to call, and what they have backed.
 *
 * The list page has an overlay for a quick look; this is the page you send someone a link to and
 * the place the portfolio lives, which an overlay is the wrong shape for.
 */
export default async function InvestorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  // Partners see the investor list but not the profile: portfolio and POC notes are the
  // proprietary part of this database.
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) {
    redirect('/investors')
  }

  const investor = await fetchInvestor(id)
  if (!investor) notFound()

  const canManage = ['founder', 'admin', 'associate', 'hr'].includes(user.role ?? '')
  const supabase = await createClient()
  const { data: team } = await supabase
    .from('users')
    .select('id, name')
    .in('role', ['founder', 'admin', 'associate', 'general', 'hr'])
    .order('name')

  return (
    <InvestorProfile
      investor={investor}
      canManage={canManage}
      team={(team ?? []) as Array<{ id: string; name: string }>}
    />
  )
}
