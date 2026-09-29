import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchProject, fetchProjectPeople } from '@/lib/projects'
import { createClient } from '@/lib/supabase/server'
import ProjectPageClient from '../_components/ProjectPageClient'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, project] = await Promise.all([getUser(), fetchProject(id)])
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')
  if (!project) notFound()

  const isFounderAdmin = ['founder', 'admin'].includes(user.role ?? '')
  const supabase = await createClient()
  const [people, { data: partners }] = await Promise.all([
    fetchProjectPeople(),
    isFounderAdmin ? supabase.from('franchise_partners').select('id, name').order('name') : Promise.resolve({ data: [] }),
  ])
  const isLead = project.members.some((m) => m.user_id === user.id && m.role === 'lead')

  return (
    <ProjectPageClient
      project={project}
      people={people}
      partners={(partners ?? []) as Array<{ id: string; name: string }>}
      isFounderAdmin={isFounderAdmin}
      canRecordPayments={isFounderAdmin || isLead}
    />
  )
}
