'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BALANCE_LEAVE_TYPES } from '@/lib/types'
import type { LeaveBalance, LeaveBalanceRow } from '@/lib/types'
import BalanceEditRow from './BalanceEditRow'
import { artForLeaveType, fmtDays } from './leave-type-meta'
import styles from '../approvals.module.css'

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/** The viewer's own remaining balance, shown while they administer everyone else's. */
function SummaryBar({ myBalances }: { myBalances: Record<string, LeaveBalance> | null }) {
  if (!myBalances) return null
  return (
    <div className={styles.summaryBar}>
      {BALANCE_LEAVE_TYPES.map((t) => {
        const art = artForLeaveType(t)
        const b = myBalances[t]
        return (
          <div key={t} className={styles.summaryItem}>
            <span className={styles.summaryIcon}>{art.icon}</span>
            <span className={styles.summaryText}>
              <span className={styles.summaryLabel}>{art.label}</span>
              <span className={styles.summaryValue}>{fmtDays(b?.remaining ?? 0)}</span>
              <span className={styles.summarySub}>days available</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function BalancesTable({ rows, myBalances }: {
  rows: LeaveBalanceRow[]
  myBalances: Record<string, LeaveBalance> | null
}) {
  const router = useRouter()
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Filtering narrows which chips are shown, not which people — the roster stays stable so a
  // person doesn't vanish from an admin list just because a filter is set.
  const visibleTypes = useMemo(
    () => (typeFilter === 'all' ? BALANCE_LEAVE_TYPES : BALANCE_LEAVE_TYPES.filter((t) => t === typeFilter)),
    [typeFilter],
  )

  return (
    <>
      <div className={styles.balancesHead}>
        <SummaryBar myBalances={myBalances} />
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter leave types"
        >
          <option value="all">All categories</option>
          {BALANCE_LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>{artForLeaveType(t).label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>No internal users found.</div>
      ) : (
        <div className={styles.balanceList}>
          {rows.map((row) => {
            const expanded = expandedUserId === row.user_id
            return (
              <div key={row.user_id} className={`${styles.balanceCard} ${expanded ? styles.balanceCardOpen : ''}`}>
                <div
                  className={styles.balanceRow}
                  onClick={() => setExpandedUserId(expanded ? null : row.user_id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedUserId(expanded ? null : row.user_id)
                    }
                  }}
                >
                  <span className={styles.avatar}>
                    {row.photo_url
                      ? <img src={row.photo_url} alt="" className={styles.avatarImg} />
                      : initials(row.user_name)}
                  </span>

                  <span className={styles.personCell}>
                    <span className={styles.personName}>{row.user_name}</span>
                    {row.designation && <span className={styles.personRole}>{row.designation}</span>}
                  </span>

                  <span className={styles.chipRow}>
                    {visibleTypes.map((t) => {
                      const art = artForLeaveType(t)
                      const b = row.balances[t]
                      const low = (b?.remaining ?? 0) <= 0
                      return (
                        <span key={t} className={styles.chip} title={art.label}>
                          <span className={styles.chipCode}>{art.code}</span>
                          <span className={`${styles.chipValue} ${low ? styles.chipValueLow : ''}`}>
                            {fmtDays(b?.remaining ?? 0)}
                          </span>
                          <span className={styles.chipMax}>/ {fmtDays(b?.entitled_days ?? 0)}</span>
                        </span>
                      )
                    })}
                  </span>

                  <span className={`${styles.rowChevron} ${expanded ? styles.rowChevronOpen : ''}`} aria-hidden="true">›</span>
                </div>

                {expanded && (
                  <BalanceEditRow
                    row={row}
                    onCancel={() => setExpandedUserId(null)}
                    onSaved={() => { setExpandedUserId(null); router.refresh() }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
