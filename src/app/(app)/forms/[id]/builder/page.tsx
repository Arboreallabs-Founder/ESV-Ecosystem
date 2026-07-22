import { notFound } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchFormForBuilder } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import FormBuilderClient from './FormBuilderClient'

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, result, pipelines] = await Promise.all([getUser(), fetchFormForBuilder(id), fetchPipelines()])

  if (!['founder', 'admin', 'associate'].includes(user?.role ?? '')) notFound()
  if (!result) notFound()

  return (
    <FormBuilderClient
      form={result.form}
      dbNodes={result.nodes}
      dbEdges={result.edges}
      pipelines={pipelines}
    />
  )
}
