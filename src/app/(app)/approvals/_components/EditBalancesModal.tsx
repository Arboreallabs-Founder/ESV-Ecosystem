'use client'

import { useState, useTransition } from 'react'
import { upsertLeaveBalance } from '@/app/actions/leave-balances'
import { BALANCE_LEAVE_TYPES, LEAVE_TYPE_LABELS } from '@/lib/types'
import type { LeaveBalanceRow } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../approvals.module.css'

export default function EditBalancesModal({ row, onClose, onSaved }: {
  row: LeaveBalanceRow; onClose: () => void; onSaved: () => void
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(BALANCE_LEAVE_TYPES.map((t) => [t, {
      entitled: String(row.balances[t]?.entitled_days ?? 0),
      manualUsed: String(row.balances[t]?.manual_used_days ?? 0),
    }])),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setField(type: string, field: 'entitled' | 'manualUsed', value: string) {
    setValues((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        for (const type of BALANCE_LEAVE_TYPES) {
          const entitled = Number(values[type].entitled)
          const manualUsed = Number(values[type].manualUsed)
          if (Number.isNaN(entitled) || Number.isNaN(manualUsed) || entitled < 0 || manualUsed < 0) {
            throw new Error(`Enter valid numbers for ${LEAVE_TYPE_LABELS[type]}.`)
          }
          await upsertLeaveBalance({ user_id: row.user_id, leave_type: type, entitled_days: entitled, manual_used_days: manualUsed })
        }
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.card} style={{ maxWidth: 480, width: '100%', background: 'var(--color-bg)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.cardTop} style={{ marginBottom: '1rem' }}>
          <div className={styles.cardTitle}>Leave balances — {row.user_name}</div>
          <button className={styles.linkBtn} onClick={onClose}>Close</button>
        </div>

        {BALANCE_LEAVE_TYPES.map((type) => (
          <div key={type} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span className={styles.cardMeta} style={{ marginTop: 0 }}>{LEAVE_TYPE_LABELS[type]}</span>
            <div>
              <label className={styles.cardMeta} style={{ marginTop: 0, display: 'block' }}>Entitled</label>
              <input
                type="number" min="0" className={styles.filterSelect} style={{ width: '100%' }}
                value={values[type].entitled}
                onChange={(e) => setField(type, 'entitled', e.target.value)}
              />
            </div>
            <div>
              <label className={styles.cardMeta} style={{ marginTop: 0, display: 'block' }}>Used (manual)</label>
              <input
                type="number" min="0" className={styles.filterSelect} style={{ width: '100%' }}
                value={values[type].manualUsed}
                onChange={(e) => setField(type, 'manualUsed', e.target.value)}
              />
            </div>
          </div>
        ))}

        {error && <div className={styles.errBox}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className={styles.rejectBtn} onClick={onClose} disabled={pending} style={{ borderColor: 'var(--color-border)', background: 'none', color: 'var(--color-text)' }}>Cancel</button>
          <button className={styles.approveBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} /> Saving…</span> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
