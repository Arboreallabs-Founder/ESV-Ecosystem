'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition } from 'react'
import { setAvailableBalances } from '@/app/actions/leave-balances'
import { BALANCE_LEAVE_TYPES } from '@/lib/types'
import type { LeaveBalanceRow } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { artForLeaveType, fmtDays } from './leave-type-meta'
import styles from '../approvals.module.css'

/* Inline edit for one person's balances — no dialog, expands in place under the row.
   HR types what's LEFT; the action back-solves the stored baseline from it. */
export default function BalanceEditRow({ row, onCancel, onSaved }: {
  row: LeaveBalanceRow; onCancel: () => void; onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(BALANCE_LEAVE_TYPES.map((t) => [t, String(row.balances[t]?.remaining ?? 0)])),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    const available: Record<string, number> = {}
    for (const t of BALANCE_LEAVE_TYPES) {
      const n = Number(values[t])
      if (!Number.isFinite(n) || n < 0) {
        setError(`Enter a valid number for ${artForLeaveType(t).label}.`); return
      }
      if (Math.round(n * 2) !== n * 2) {
        setError('Balances move in half-day steps (e.g. 12 or 12.5).'); return
      }
      available[t] = n
    }
    startTransition(async () => {
      try {
        await setAvailableBalances({ user_id: row.user_id, available })
        onSaved()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.editBody} onClick={(e) => e.stopPropagation()}>
      <div className={styles.editFields}>
        {BALANCE_LEAVE_TYPES.map((t) => {
          const art = artForLeaveType(t)
          const b = row.balances[t]
          return (
            <div key={t} className={styles.editField}>
              <label className={styles.editLabel} htmlFor={`${row.user_id}-${t}`}>{art.label}</label>
              <div className={styles.editInputRow}>
                <input
                  id={`${row.user_id}-${t}`}
                  type="number"
                  min="0"
                  step="0.5"
                  className={styles.editInput}
                  value={values[t]}
                  onChange={(e) => setValues((p) => ({ ...p, [t]: e.target.value }))}
                />
                <span className={styles.editMax}>/ {fmtDays(b?.entitled_days ?? 0)} days</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && <div className={styles.errBox}>{error}</div>}

      <div className={styles.editActions}>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={pending}>Cancel</button>
        <button className={styles.saveBtn} onClick={submit} disabled={pending}>
          {pending
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span>
            : 'Save'}
        </button>
      </div>
    </div>
  )
}
