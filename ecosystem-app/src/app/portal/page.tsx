import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchPartnerDeals } from '@/lib/deals'
import AppShell from '@/app/_components/AppShell'
import PortalClient from './PortalClient'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email, franchise_partner_id')
    .eq('id', user.id)
    .single()

  const role = userData?.role
  const franchisePartnerId = userData?.franchise_partner_id ?? null

  const referredDeals = franchisePartnerId
    ? await fetchPartnerDeals(franchisePartnerId)
    : []

  return (
    <AppShell user={{ name: userData?.name ?? user.email, role: role ?? 'franchise_partner', email: userData?.email ?? user.email ?? '' }}>
      <PortalClient
        partnerName={userData?.name ?? user.email ?? 'Partner'}
        franchisePartnerId={franchisePartnerId}
        referredDeals={referredDeals}
      />
    </AppShell>
  )
}
