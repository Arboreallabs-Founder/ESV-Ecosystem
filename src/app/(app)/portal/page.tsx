import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import PortalClient from './PortalClient'
import { getPartnerFormLinks } from '@/app/actions/forms'

export default async function PortalPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: publishedForms }, partnerLinks] = await Promise.all([
    supabase.from('forms').select('id, title, pipeline:pipelines(name)').eq('published', true),
    getPartnerFormLinks(),
  ])

  return (
    <PortalClient
      partnerName={user.name}
      franchisePartnerId={user.franchise_partner_id}
      publishedForms={(publishedForms ?? []).map((f: any) => ({ id: f.id, title: f.title, pipeline: f.pipeline ?? null }))}
      partnerLinks={partnerLinks}
    />
  )
}
