import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import PortalClient from './PortalClient'
import { getPartnerFormLinks } from '@/app/actions/forms'

export default async function PortalPage() {
  const supabase = await createClient()
  const [user, { data: publishedForms }, partnerLinks] = await Promise.all([
    getUser(),
    supabase.from('forms').select('id, title, pipeline:pipelines(name)').eq('published', true),
    getPartnerFormLinks(),
  ])
  if (!user) redirect('/login')

  return (
    <PortalClient
      partnerName={user.name}
      franchisePartnerId={user.franchise_partner_id}
      publishedForms={(publishedForms ?? []).map((f: any) => ({ id: f.id, title: f.title, pipeline: f.pipeline ?? null }))}
      partnerLinks={partnerLinks}
    />
  )
}
