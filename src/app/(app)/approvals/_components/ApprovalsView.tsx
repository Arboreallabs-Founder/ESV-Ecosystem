'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideLeaveRequest, deleteLeaveRequestAsAdmin } from '@/app/actions/leave-requests'
import { decideExpenseRequest } from '@/app/actions/expense-requests'
import { LEAVE_TYPE_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/types'
import type { LeaveRequest, ExpenseRequest, LeaveBalanceRow, LeaveBalance, LeavePolicy } from '@/lib/types'
import BalancesTable from './BalancesTable'
import Avatar from '@/app/_components/Avatar'
import styles from '../approvals.module.css'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const cls = status === 'approved' ? styles.statusApproved : status === 'rejected' ? styles.statusRejected : styles.statusPending
  return <span className={`${styles.statusPill} ${cls}`}>{status}</span>
}

export default function ApprovalsView({
  pendingLeave, pendingExpense, recentLeave, recentExpense, allLeave, balances, myBalances,
  policy, userRole,
}: {
  pendingLeave: LeaveRequest[]; pendingExpense: ExpenseRequest[]
  recentLeave: LeaveRequest[]; recentExpense: ExpenseRequest[]
  allLeave: LeaveRequest[]
  balances: LeaveBalanceRow[]
  myBalances: Record<string, LeaveBalance> | null
  policy: LeavePolicy
  userRole: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'approvals' | 'team-leaves' | 'balances'>('approvals')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [personFilter, setPersonFilter] = useState('')

  function decide(kind: 'leave' | 'expense', id: string, decision: 'approved' | 'rejected') {
    setError(null)
    startTransition(async () => {
      try {
        if (kind === 'leave') await decideLeaveRequest(id, decision)
        else await decideExpenseRequest(id, decision)
        router.refresh()
      } catch (e) { setError((e as Error).message) }
    })
  }

  function cancelLeave(id: string) {
    if (!confirm('Cancel this leave request? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteLeaveRequestAsAdmin(id)
        router.refresh()
      } catch (e) { setError((e as Error).message) }
    })
  }

  const people = useMemo(() => {
    const names = new Set(allLeave.map((r) => r.requester?.name).filter((n): n is string => !!n))
    return [...names].sort()
  }, [allLeave])

  const filteredLeave = personFilter ? allLeave.filter((r) => r.requester?.name === personFilter) : allLeave

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Approvals</div>
          <div className={styles.pageSub}>Leave and expense requests</div>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tabBtn} ${tab === 'approvals' ? styles.tabBtnActive : ''}`} onClick={() => setTab('approvals')}>Approvals</button>
          <button className={`${styles.tabBtn} ${tab === 'team-leaves' ? styles.tabBtnActive : ''}`} onClick={() => setTab('team-leaves')}>Team leaves</button>
          <button className={`${styles.tabBtn} ${tab === 'balances' ? styles.tabBtnActive : ''}`} onClick={() => setTab('balances')}>Balances</button>
        </div>
      </div>

      <div className={styles.content}>
        {error && <div className={styles.errBox}>{error}</div>}

        {tab === 'approvals' && (
          <>
            <div className={styles.sectionTitle}>Leave requests — pending</div>
            {pendingLeave.length === 0 ? (
              <div className={styles.empty}>Nothing pending.</div>
            ) : (
              <div className={styles.list}>
                {pendingLeave.map((r) => (
                  <div key={r.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitle}><Avatar name={r.requester?.name} photoUrl={r.requester?.photo_url} size="sm" />{r.requester?.name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]}</div>
                        <div className={styles.cardMeta}>{formatDate(r.start_date)} – {formatDate(r.end_date)}</div>
                        {r.reason && <div className={styles.cardReason}>{r.reason}</div>}
                      </div>
                      <div className={styles.cardActions}>
                        <button className={styles.approveBtn} onClick={() => decide('leave', r.id, 'approved')}>Approve</button>
                        <button className={styles.rejectBtn} onClick={() => decide('leave', r.id, 'rejected')}>Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.sectionTitle}>Expense requests — pending</div>
            {pendingExpense.length === 0 ? (
              <div className={styles.empty}>Nothing pending.</div>
            ) : (
              <div className={styles.list}>
                {pendingExpense.map((r) => (
                  <div key={r.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitle}><Avatar name={r.requester?.name} photoUrl={r.requester?.photo_url} size="sm" />{r.requester?.name ?? 'Unknown'} — {EXPENSE_TYPE_LABELS[r.expense_type]} (₹{r.amount})</div>
                        {r.description && <div className={styles.cardReason}>{r.description}</div>}
                        {r.invoice_signed_url && (
                          <a href={r.invoice_signed_url} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>View invoice</a>
                        )}
                      </div>
                      <div className={styles.cardActions}>
                        <button className={styles.approveBtn} onClick={() => decide('expense', r.id, 'approved')}>Approve</button>
                        <button className={styles.rejectBtn} onClick={() => decide('expense', r.id, 'rejected')}>Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(recentLeave.length > 0 || recentExpense.length > 0) && (
              <>
                <div className={styles.sectionTitle}>Recently decided</div>
                <div className={styles.list}>
                  {recentLeave.map((r) => (
                    <div key={r.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div>
                          <div className={styles.cardTitle}><Avatar name={r.requester?.name} photoUrl={r.requester?.photo_url} size="sm" />{r.requester?.name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]}</div>
                          <div className={styles.cardMeta}>{formatDate(r.start_date)} – {formatDate(r.end_date)}{r.decided_by_user?.name ? ` · decided by ${r.decided_by_user.name}` : ''}</div>
                        </div>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                  ))}
                  {recentExpense.map((r) => (
                    <div key={r.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div>
                          <div className={styles.cardTitle}><Avatar name={r.requester?.name} photoUrl={r.requester?.photo_url} size="sm" />{r.requester?.name ?? 'Unknown'} — {EXPENSE_TYPE_LABELS[r.expense_type]} (₹{r.amount})</div>
                          <div className={styles.cardMeta}>{r.decided_by_user?.name ? `Decided by ${r.decided_by_user.name}` : ''}</div>
                        </div>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'team-leaves' && (
          <>
            <div className={styles.filterRow}>
              <select className={styles.filterSelect} value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
                <option value="">Everyone</option>
                {people.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className={styles.pageSub} style={{ marginTop: 0 }}>{filteredLeave.length} request{filteredLeave.length === 1 ? '' : 's'}</span>
            </div>

            {filteredLeave.length === 0 ? (
              <div className={styles.empty}>No leave requests found.</div>
            ) : (
              <div className={styles.list}>
                {filteredLeave.map((r) => (
                  <div key={r.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitle}><Avatar name={r.requester?.name} photoUrl={r.requester?.photo_url} size="sm" />{r.requester?.name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]}</div>
                        <div className={styles.cardMeta}>
                          {formatDate(r.start_date)} – {formatDate(r.end_date)}
                          {r.decided_by_user?.name ? ` · decided by ${r.decided_by_user.name}` : ''}
                        </div>
                        {r.reason && <div className={styles.cardReason}>{r.reason}</div>}
                      </div>
                      <div className={styles.cardActions}>
                        <StatusPill status={r.status} />
                        <button className={styles.approveBtn} onClick={() => decide('leave', r.id, 'approved')}>
                          {r.status === 'approved' ? 'Re-approve' : 'Approve'}
                        </button>
                        <button className={styles.rejectBtn} onClick={() => decide('leave', r.id, 'rejected')}>
                          {r.status === 'rejected' ? 'Re-reject' : 'Reject'}
                        </button>
                        <button className={styles.linkBtn} onClick={() => cancelLeave(r.id)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'balances' && (
          <BalancesTable rows={balances} myBalances={myBalances} policy={policy} userRole={userRole} />
        )}
      </div>
    </div>
  )
}
