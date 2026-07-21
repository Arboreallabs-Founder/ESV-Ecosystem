import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal, fetchActiveDealInvestorSummary, fetchCategories } from '@/lib/active-deals'
import { fetchCompanyOptions } from '@/lib/companies'
import { createClient } from '@/lib/supabase/server'
import { getEntryAnswers, getEntryStageHistory, getEntryStageAnswers } from '@/app/actions/pipelines'
import type { PipelineEntryStageHistory } from '@/lib/types'
import ActiveDealPageClient from '../_components/ActiveDealPageClient'

export default async function ActiveDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [user, deal, categories, companyOptions, investorSummary, { data: teamRows }] = await Promise.all([
    getUser(),
    fetchActiveDeal(id),
    fetchCategories(),
    fetchCompanyOptions(),
    fetchActiveDealInvestorSummary(id),
    supabase.from('users').select('id, name').neq('role', 'franchise_partner').order('name'),
  ])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  const [answers, history, stageAnswers] = await Promise.all([
    getEntryAnswers(deal.pipeline_entry_id),
    getEntryStageHistory(deal.pipeline_entry_id),
    getEntryStageAnswers(deal.pipeline_entry_id),
  ])

  const teamMembers = (teamRows ?? []) as Array<{ id: string; name: string }>

  return (
    <ActiveDealPageClient
      deal={deal}
      userRole={user.role ?? 'associate'}
      categories={categories}
      companyOptions={companyOptions}
      investorSummary={investorSummary}
      answers={answers}
      history={history as PipelineEntryStageHistory[]}
      stageAnswers={stageAnswers}
      teamMembers={teamMembers}
    />
  )
}
