import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchPartnerUsers } from '@/lib/partners'
import AppShell from '@/app/_components/AppShell'
import PartnerTable from './_components/PartnerTable'

export default async function PartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  const role = userData?.role
  if (!role || !['founder', 'admin'].includes(role)) redirect('/dashboard')

  const partnerUsers = await fetchPartnerUsers()

  return (
    <AppShell user={userData ?? { name: user.email, role: 'admin', email: user.email }}>
      <PartnerTable partnerUsers={partnerUsers} />
    </AppShell>
  )
}
