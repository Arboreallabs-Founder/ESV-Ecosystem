import { fetchPipelines } from '@/lib/pipelines'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/_components/AppShell'
import PipelineList from './_components/PipelineList'

export default async function PipelinesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRow } = await supabase.from('users').select('name, role, email').eq('id', user!.id).single()
  const pipelines = await fetchPipelines()
  const canManage = ['founder', 'admin'].includes(userRow?.role ?? '')

  return (
    <AppShell user={userRow ?? { name: user!.email, role: 'associate', email: user!.email }}>
      <PipelineList pipelines={pipelines} canManage={canManage} />
    </AppShell>
  )
}
