import { notFound } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchPipeline, fetchPipelineEntries } from '@/lib/pipelines'
import { fetchCompanyOptions } from '@/lib/companies'
import { createClient } from '@/lib/supabase/server'
import PipelineBoardClient from './PipelineBoardClient'

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [user, pipeline, entries, { data: teamRows }, { data: allForms }, companyOptions] = await Promise.all([
    getUser(),
    fetchPipeline(id),
    fetchPipelineEntries(id),
    supabase.from('users').select('id, name').neq('role', 'franchise_partner').order('name'),
    supabase.from('forms').select('id, title, published, pipeline_id').order('created_at', { ascending: false }),
    fetchCompanyOptions(),
  ])
  if (!pipeline) notFound()

  const canManage = ['founder', 'admin'].includes(user?.role ?? '')
  const teamMembers = (teamRows ?? []) as Array<{ id: string; name: string }>
  const forms = (allForms ?? []) as Array<{ id: string; title: string; published: boolean; pipeline_id: string | null }>

  return (
    <PipelineBoardClient pipeline={pipeline} entries={entries} canManage={canManage} teamMembers={teamMembers} forms={forms} currentUserId={user?.id} companyOptions={companyOptions} />
  )
}
