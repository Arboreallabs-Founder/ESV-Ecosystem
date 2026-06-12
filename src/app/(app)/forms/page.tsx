import { getUser } from '@/lib/user'
import { fetchForms } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import FormList from './_components/FormList'

export default async function FormsPage() {
  const [user, forms, pipelines] = await Promise.all([getUser(), fetchForms(), fetchPipelines()])
  const canManage = ['founder', 'admin'].includes(user?.role ?? '')

  return <FormList forms={forms} pipelines={pipelines} canManage={canManage} />
}
