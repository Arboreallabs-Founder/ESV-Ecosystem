import { notFound } from 'next/navigation'
import { fetchPipeline, fetchPipelineEntries } from '@/lib/pipelines'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/_components/AppShell'
import PipelineBoardClient from './PipelineBoardClient'

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRow } = await supabase.from('users').select('name, role, email').eq('id', user!.id).single()

  const [pipeline, entries, { data: teamRows }, { data: allForms }] = await Promise.all([
    fetchPipeline(id),
    fetchPipelineEntries(id),
    supabase.from('users').select('id, name').neq('role', 'franchise_partner').order('name'),
    supabase.from('forms').select('id, title, published, pipeline_id').order('created_at', { ascending: false }),
  ])
  if (!pipeline) notFound()

  const canManage = ['founder', 'admin'].includes(userRow?.role ?? '')
  const teamMembers = (teamRows ?? []) as Array<{ id: string; name: string }>
  const forms = (allForms ?? []) as Array<{ id: string; title: string; published: boolean; pipeline_id: string | null }>

  return (
    <AppShell user={userRow ?? { name: user!.email, role: 'associate', email: user!.email }} fullWidth>
      <PipelineBoardClient pipeline={pipeline} entries={entries} canManage={canManage} teamMembers={teamMembers} forms={forms} />
    </AppShell>
  )
}
