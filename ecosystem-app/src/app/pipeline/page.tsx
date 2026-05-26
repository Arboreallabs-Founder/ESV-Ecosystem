import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchAllDeals } from '@/lib/deals'
import AppShell from '@/app/_components/AppShell'
import KanbanBoard from './_components/KanbanBoard'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  const role = userData?.role
  if (role === 'franchise_partner') redirect('/portal')

  const deals = await fetchAllDeals()

  return (
    <AppShell user={userData ?? { name: user.email, role: 'associate', email: user.email }} fullWidth>
      <KanbanBoard initialDeals={deals} userRole={role ?? 'associate'} />
    </AppShell>
  )
}
