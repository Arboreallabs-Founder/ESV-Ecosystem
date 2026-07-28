import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getUser } from '@/lib/user'
import { fetchAdjustments, fetchPerformanceRows, fetchPerformanceWeights } from '@/lib/performance'
import { SCORE_PERIOD_LABELS } from '@/lib/types'
import type { ScorePeriod } from '@/lib/types'
import TeamAnalytics from './_components/TeamAnalytics'
import MyScorecard from './_components/MyScorecard'

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']
const LEADERS = ['founder', 'admin', 'hr']

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!INTERNAL.includes(user.role ?? '')) redirect('/dashboard')

  const { period: rawPeriod } = await searchParams
  const period: ScorePeriod = (rawPeriod && rawPeriod in SCORE_PERIOD_LABELS ? rawPeriod : '90d') as ScorePeriod

  const isLeader = LEADERS.includes(user.role ?? '')
  const canEditWeights = ['founder', 'admin'].includes(user.role ?? '')

  const [rows, adjustments, weights] = await Promise.all([
    fetchPerformanceRows(period),
    fetchAdjustments(period),
    fetchPerformanceWeights(),
  ])

  // PeriodPicker reads the query string via useSearchParams, so both branches sit under Suspense.
  return (
    <Suspense fallback={null}>
      {isLeader ? (
        <TeamAnalytics
          rows={rows}
          adjustments={adjustments}
          weights={weights}
          period={period}
          canEditWeights={canEditWeights}
        />
      ) : (
        <MyScorecard
          row={rows.find((r) => r.user_id === user.id) ?? null}
          adjustments={adjustments.filter((a) => a.user_id === user.id)}
          weights={weights}
          period={period}
        />
      )}
    </Suspense>
  )
}
