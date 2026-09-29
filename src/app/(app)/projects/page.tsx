import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchProjectPeople, fetchProjects } from '@/lib/projects'
import { fetchCompanyOptions } from '@/lib/companies'
import ProjectsList from './_components/ProjectsList'

export default async function ProjectsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const [projects, people, companyOptions] = await Promise.all([
    fetchProjects(), fetchProjectPeople(), fetchCompanyOptions(),
  ])

  return (
    <ProjectsList
      projects={projects}
      people={people}
      companyOptions={companyOptions}
      userId={user.id}
      canCreate={!user.is_external}
    />
  )
}
