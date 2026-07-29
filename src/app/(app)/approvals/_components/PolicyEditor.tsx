'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLeavePolicy } from '@/app/actions/leave-balances'
import { BALANCE_LEAVE_TYPES, POLICY_COLUMN } from '@/lib/types'
import type { LeavePolicy, LeaveType } from '@/lib/types'
import { artForLeaveType, fmtDays } from './leave-type-meta'
import styles from '../approvals.module.css'

/**
 * The org-wide entitlement per leave type — how many days everyone starts the year with.
 *
 * Kept visually distinct from the summary bar above it on purpose: that bar shows the *viewer's
 * own remaining* days, this is the org standard everyone is measured against. The two are
 * different numbers that happen to coincide before anyone takes leave, so conflating them into
 * one editable strip would be a trap.
 *
 * Changing an entitlement re-bases everyone's remaining balance, since remaining is always
 * computed (entitlement − manual baseline − approved days) rather than stored.
 */
export default function PolicyEditor({ policy, canEdit }: { policy: LeavePolicy; canEdit: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit() {
    const next: Record<string, string> = {}
    for (const t of BALANCE_LEAVE_TYPES) next[t] = String(entitlement(t))
    setDraft(next)
    setError(null)
    setOpen(true)
  }

  function entitlement(t: LeaveType): number {
    const col = POLICY_COLUMN[t]
    return col ? Number(policy[col] ?? 0) : 0
  }

  function handleSave() {
    setError(null)
    const values: Record<string, number> = {}
    for (const t of BALANCE_LEAVE_TYPES) {
      const n = Number(draft[t])
      if (!Number.isFinite(n) || n < 0) {
        setError(`${artForLeaveType(t).label} must be zero or more.`)
        return
      }
      // Half-day granularity, matching how balances and requests move everywhere else.
      if (Math.round(n * 2) !== n * 2) {
        setError('Entitlements move in half-day steps.')
        return
      }
      values[t] = n
    }

    startTransition(async () => {
      try {
        await updateLeavePolicy({
          earned_days: values.earned,
          sick_days: values.sick,
          my_day_days: values.my_day,
          compensatory_days: values.compensatory,
          wfh_days: values.wfh,
        })
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div className={styles.policyCard}>
      <div className={styles.policyHead}>
        <div>
          <div className={styles.policyTitle}>Annual entitlement</div>
          <div className={styles.policySub}>
            The org-wide standard everyone is measured against. Changing it re-bases everyone&apos;s
            remaining days.
          </div>
        </div>
        {canEdit && !open && (
          <button type="button" className={styles.policyEditBtn} onClick={startEdit}>Edit</button>
        )}
      </div>

      {open ? (
        <>
          <div className={styles.policyGrid}>
            {BALANCE_LEAVE_TYPES.map((t) => {
              const art = artForLeaveType(t)
              return (
                <label key={t} className={styles.policyField}>
                  <span className={styles.policyFieldLabel}>{art.label}</span>
                  <span className={styles.policyInputRow}>
                    <input
                      className={styles.policyInput}
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft[t] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [t]: e.target.value }))}
                    />
                    <span className={styles.policyUnit}>days</span>
                  </span>
                </label>
              )
            })}
          </div>
          {error && <div className={styles.policyError}>{error}</div>}
          <div className={styles.policyActions}>
            <button type="button" className={styles.policyCancelBtn} onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </button>
            <button type="button" className={styles.policySaveBtn} onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.policyGrid}>
          {BALANCE_LEAVE_TYPES.map((t) => {
            const art = artForLeaveType(t)
            return (
              <div key={t} className={styles.policyField}>
                <span className={styles.policyFieldLabel}>{art.label}</span>
                <span className={styles.policyReadValue}>
                  {fmtDays(entitlement(t))} <span className={styles.policyUnit}>days</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
