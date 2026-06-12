import { getUser } from '@/lib/user'
import { fetchPipelines } from '@/lib/pipelines'
import PipelineList from './_components/PipelineList'

export default async function PipelinesPage() {
  const [user, pipelines] = await Promise.all([getUser(), fetchPipelines()])
  const canManage = ['founder', 'admin'].includes(user?.role ?? '')

  return <PipelineList pipelines={pipelines} canManage={canManage} />
}
