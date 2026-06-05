import { notFound } from 'next/navigation'
import { fetchFormForBuilder } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import { createClient } from '@/lib/supabase/server'
import FormBuilderClient from './FormBuilderClient'

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRow } = await supabase.from('users').select('role').eq('id', user!.id).single()

  if (!['founder', 'admin'].includes(userRow?.role ?? '')) notFound()

  const [result, pipelines] = await Promise.all([fetchFormForBuilder(id), fetchPipelines()])
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
