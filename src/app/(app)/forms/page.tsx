import { getUser } from '@/lib/user'
import { fetchForms } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import FormList from './_components/FormList'

export default async function FormsPage() {
  const [user, forms, pipelines] = await Promise.all([getUser(), fetchForms(), fetchPipelines()])
  // Building/linking forms is open to associates too; deleting a form or an issued link stays admin-only.
  const canBuild = ['founder', 'admin', 'associate'].includes(user?.role ?? '')
  const canDelete = ['founder', 'admin'].includes(user?.role ?? '')

  return <FormList forms={forms} pipelines={pipelines} canBuild={canBuild} canDelete={canDelete} />
}
