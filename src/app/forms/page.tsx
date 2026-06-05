import { fetchForms } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/_components/AppShell'
import FormList from './_components/FormList'

export default async function FormsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRow } = await supabase.from('users').select('name, role, email').eq('id', user!.id).single()
  const [forms, pipelines] = await Promise.all([fetchForms(), fetchPipelines()])
  const canManage = ['founder', 'admin'].includes(userRow?.role ?? '')

  return (
    <AppShell user={userRow ?? { name: user!.email, role: 'associate', email: user!.email }}>
      <FormList forms={forms} pipelines={pipelines} canManage={canManage} />
    </AppShell>
  )
}
