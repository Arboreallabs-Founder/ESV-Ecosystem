'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAdjustment } from '@/app/actions/performance'
import Spinner from '@/app/_components/Spinner'
import styles from '../analytics.module.css'

export default function AdjustmentModal({ people, onClose }: {
  people: Array<{ id: string; name: string }>; onClose: () => void
}) {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    const n = Number(points)
    if (!userId) { setError('Choose who this applies to.'); return }
    if (!Number.isFinite(n) || n === 0) { setError('Enter a non-zero number of points.'); return }
    if (!reason.trim()) { setError('A reason is required.'); return }

    startTransition(async () => {
      try {
        await createAdjustment({ user_id: userId, points: n, reason, occurred_on: occurredOn })
        onClose()
        router.refresh()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add adjustment</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.cardNote} style={{ marginTop: 0 }}>
            For things the data can&apos;t see. The reason is visible to the person it applies to.
          </p>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Person *</label>
            <select className={styles.input} value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus>
              <option value="">Choose someone…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Points *</label>
              <input className={styles.input} type="number" step="1" value={points}
                onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 10 or -5" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Date</label>
              <input className={styles.input} type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Reason *</label>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="What happened, in a sentence…" />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
