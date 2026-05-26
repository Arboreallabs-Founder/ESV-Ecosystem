import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDeal, fetchDealNotes, fetchDealDocuments, fetchDealHistory } from '@/lib/deals'
import { fetchDealOutreach, fetchAllInvestors } from '@/lib/investors'
import AppShell from '@/app/_components/AppShell'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params

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

  const [deal, notes, documents, history, outreach, investors] = await Promise.all([
    fetchDeal(dealId),
    fetchDealNotes(dealId),
    fetchDealDocuments(dealId),
    fetchDealHistory(dealId),
    fetchDealOutreach(dealId),
    fetchAllInvestors(),
  ])

  if (!deal) notFound()

  return (
    <AppShell user={userData ?? { name: user.email, role: 'associate', email: user.email }}>
      <DealDetailClient
        deal={deal}
        notes={notes}
        documents={documents}
        history={history}
        outreach={outreach}
        investors={investors}
        userRole={role ?? 'associate'}
      />
    </AppShell>
  )
}
