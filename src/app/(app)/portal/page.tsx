import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import PortalClient from './PortalClient'
import { getPartnerFormLinks } from '@/app/actions/forms'
import { fetchPartnerProjects } from '@/lib/projects'
import PartnerProjects from './_components/PartnerProjects'

export default async function PortalPage() {
  const supabase = await createClient()
  const [user, { data: publishedForms }, partnerLinks, projects] = await Promise.all([
    getUser(),
    // The partner form only. This offered every published form in the org, which is what let a
    // partner mint links against the Series A and Pre-Seed applications — RLS permitted it, so the
    // dropdown was the whole of the control. The database refuses it now (20260924); this stops
    // showing them a list where all but one entry would be rejected.
    supabase.from('forms').select('id, title, pipeline:pipelines(name)')
      .eq('published', true).eq('is_partner_form', true),
    getPartnerFormLinks(),
    // Prefunding projects a founder/admin credited to this partner (20261014000000).
    fetchPartnerProjects(),
  ])
  if (!user) redirect('/login')

  return (
    <>
      <PortalClient
        partnerName={user.name}
        franchisePartnerId={user.franchise_partner_id}
        publishedForms={(publishedForms ?? []).map((f: any) => ({ id: f.id, title: f.title, pipeline: f.pipeline ?? null }))}
        partnerLinks={partnerLinks}
      />
      {user.franchise_partner_id && <PartnerProjects projects={projects} />}
    </>
  )
}
