'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BALANCE_LEAVE_TYPES, LEAVE_TYPE_LABELS } from '@/lib/types'
import type { LeaveBalanceRow } from '@/lib/types'
import EditBalancesModal from './EditBalancesModal'
import styles from '../approvals.module.css'

export default function BalancesTable({ rows }: { rows: LeaveBalanceRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<LeaveBalanceRow | null>(null)

  if (rows.length === 0) return <div className={styles.empty}>No internal users found.</div>

  return (
    <>
      <div className={styles.list}>
        {rows.map((row) => (
          <div key={row.user_id} className={styles.card}>
            <div className={styles.cardTop}>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span className={styles.cardTitle}>{row.user_name}</span>
                {BALANCE_LEAVE_TYPES.map((type) => {
                  const b = row.balances[type]
                  return (
                    <span key={type} className={styles.cardMeta} style={{ marginTop: 0 }}>
                      {LEAVE_TYPE_LABELS[type]}: <strong style={{ color: b.remaining < 0 ? 'var(--color-destructive)' : 'var(--color-text)' }}>{b.remaining}</strong> / {b.entitled_days}
                    </span>
                  )
                })}
              </div>
              <button className={styles.linkBtn} onClick={() => setEditing(row)}>Edit</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditBalancesModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh() }} />
      )}
    </>
  )
}
