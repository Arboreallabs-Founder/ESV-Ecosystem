import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchActiveDeal, fetchActiveDealInvestorSummary, fetchCategories } from '@/lib/active-deals'
import { fetchCompanyOptions } from '@/lib/companies'
import { getEntryAnswers, getEntryStageHistory, getEntryStageAnswers } from '@/app/actions/pipelines'
import type { PipelineEntryStageHistory } from '@/lib/types'
import ActiveDealPageClient from '../_components/ActiveDealPageClient'

export default async function ActiveDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, deal, categories, companyOptions, investorSummary] = await Promise.all([
    getUser(),
    fetchActiveDeal(id),
    fetchCategories(),
    fetchCompanyOptions(),
    fetchActiveDealInvestorSummary(id),
  ])
  if (!user || !['founder', 'admin', 'associate', 'franchise_partner'].includes(user.role ?? '')) redirect('/login')
  if (!deal) notFound()

  const [answers, history, stageAnswers] = await Promise.all([
    getEntryAnswers(deal.pipeline_entry_id),
    getEntryStageHistory(deal.pipeline_entry_id),
    getEntryStageAnswers(deal.pipeline_entry_id),
  ])

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
    />
  )
}
