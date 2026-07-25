import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal, fetchCategories } from '@/lib/active-deals'
import { fetchCompanyOptions } from '@/lib/companies'
import { getDealInvestors } from '@/app/actions/active-deals'
import { createClient } from '@/lib/supabase/server'
import { getEntryAnswers, getEntryStageHistory, getEntryStageAnswers } from '@/app/actions/pipelines'
import type { PipelineEntryStageHistory } from '@/lib/types'
import ActiveDealPageClient from '../_components/ActiveDealPageClient'

export default async function ActiveDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [user, deal, categories, companyOptions, { data: teamRows }] = await Promise.all([
    getUser(),
    fetchActiveDeal(id),
    fetchCategories(),
    fetchCompanyOptions(),
    supabase.from('users').select('id, name').not('role', 'in', '(franchise_partner,general)').order('name'),
  ])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner', 'general'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  // `general` can't view investors (getDealInvestors' guard rejects them), so skip the fetch
  // entirely for that role — the dashboard hides the investor section for them anyway.
  const canViewInvestors = user.role !== 'general'
  const [answers, history, stageAnswers, investorData] = await Promise.all([
    getEntryAnswers(deal.pipeline_entry_id),
    getEntryStageHistory(deal.pipeline_entry_id),
    getEntryStageAnswers(deal.pipeline_entry_id),
    canViewInvestors ? getDealInvestors(id) : Promise.resolve({ investors: [], dealFieldValues: [] }),
  ])

  const teamMembers = (teamRows ?? []) as Array<{ id: string; name: string }>

  return (
    <ActiveDealPageClient
      deal={deal}
      userRole={user.role ?? 'associate'}
      categories={categories}
      companyOptions={companyOptions}
      investors={investorData.investors}
      dealFieldValues={investorData.dealFieldValues}
      answers={answers}
      history={history as PipelineEntryStageHistory[]}
      stageAnswers={stageAnswers}
      teamMembers={teamMembers}
    />
  )
}
