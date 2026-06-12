import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/_components/AppShell'
import PortalClient from './PortalClient'
import { getPartnerFormLinks } from '@/app/actions/forms'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email, franchise_partner_id')
    .eq('id', user.id)
    .single()

  const franchisePartnerId = userData?.franchise_partner_id ?? null

  const [{ data: publishedForms }, partnerLinks] = await Promise.all([
    supabase.from('forms').select('id, title, pipeline:pipelines(name)').eq('published', true),
    getPartnerFormLinks(),
  ])

  return (
    <AppShell user={{ name: userData?.name ?? user.email, role: userData?.role ?? 'franchise_partner', email: userData?.email ?? user.email ?? '' }}>
      <PortalClient
        partnerName={userData?.name ?? user.email ?? 'Partner'}
        franchisePartnerId={franchisePartnerId}
        publishedForms={(publishedForms ?? []).map((f: any) => ({ id: f.id, title: f.title, pipeline: f.pipeline ?? null }))}
        partnerLinks={partnerLinks}
      />
    </AppShell>
  )
}
