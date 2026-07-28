'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePerformanceWeights, type WeightsInput } from '@/app/actions/performance'
import type { PerformanceWeights } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../analytics.module.css'

const FIELDS: Array<{ key: keyof WeightsInput; label: string; hint: string }> = [
  { key: 'kudos_received', label: 'Kudos received', hint: 'per kudos' },
  { key: 'task_on_time', label: 'Task on time', hint: 'per task' },
  { key: 'task_overdue', label: 'Task overdue', hint: 'per open task past deadline' },
  { key: 'task_pushed', label: 'Deadline pushed', hint: 'per task pushed at least once' },
  { key: 'recurring_completed', label: 'Recurring duty done', hint: 'per completion' },
  { key: 'event_attended', label: 'Event attended', hint: 'per event' },
]

export default function WeightsPanel({ weights, onClose }: {
  weights: PerformanceWeights; onClose: () => void
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(weights[f.key])])),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    const parsed: Record<string, number> = {}
    for (const f of FIELDS) {
      const n = Number(values[f.key])
      if (!Number.isFinite(n)) { setError(`${f.label} must be a number.`); return }
      parsed[f.key] = n
    }
    startTransition(async () => {
      try {
        await updatePerformanceWeights(parsed as unknown as WeightsInput)
        onClose()
        router.refresh()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Scoring weights</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.cardNote} style={{ marginTop: 0 }}>
            These are a judgement call, not a measurement — changing them recomputes every score.
            Negative numbers subtract.
          </p>
          {FIELDS.map((f) => (
            <div key={f.key} className={styles.weightRow}>
              <span className={styles.weightLabel}>
                {f.label}<span className={styles.weightHint}>{f.hint}</span>
              </span>
              <input
                className={styles.weightInput}
                type="number" step="0.5"
                value={values[f.key]}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : 'Save weights'}
          </button>
        </div>
      </div>
    </div>
  )
}
