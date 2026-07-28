'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SCORE_PERIOD_LABELS } from '@/lib/types'
import type { ScorePeriod } from '@/lib/types'
import styles from '../analytics.module.css'

const PERIODS = Object.keys(SCORE_PERIOD_LABELS) as ScorePeriod[]

/* Period lives in the URL rather than component state so a given view is linkable and survives
   a refresh — and so the server can do the period filtering rather than shipping all history
   to the client. */
export default function PeriodPicker({ period }: { period: ScorePeriod }) {
  const router = useRouter()
  const params = useSearchParams()

  function select(p: ScorePeriod) {
    const next = new URLSearchParams(params.toString())
    next.set('period', p)
    router.push(`/analytics?${next.toString()}`)
  }

  return (
    <div className={styles.periodRow}>
      <label className={styles.periodLabel} htmlFor="period">Period</label>
      <select
        id="period"
        className={styles.periodSelect}
        value={period}
        onChange={(e) => select(e.target.value as ScorePeriod)}
      >
        {PERIODS.map((p) => <option key={p} value={p}>{SCORE_PERIOD_LABELS[p]}</option>)}
      </select>
    </div>
  )
}
