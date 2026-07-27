'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideLeaveRequest } from '@/app/actions/leave-requests'
import { decideExpenseRequest } from '@/app/actions/expense-requests'
import { LEAVE_TYPE_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/types'
import type { LeaveRequest, ExpenseRequest } from '@/lib/types'
import styles from '../approvals.module.css'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const cls = status === 'approved' ? styles.statusApproved : status === 'rejected' ? styles.statusRejected : styles.statusPending
  return <span className={`${styles.statusPill} ${cls}`}>{status}</span>
}

export default function ApprovalsView({
  pendingLeave, pendingExpense, recentLeave, recentExpense,
}: {
  pendingLeave: LeaveRequest[]; pendingExpense: ExpenseRequest[]
  recentLeave: LeaveRequest[]; recentExpense: ExpenseRequest[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.pageTitle}>Approvals</div>
        <div className={styles.pageSub}>Leave and expense requests awaiting a decision</div>
      </div>

      <div className={styles.content}>
        {error && <div className={styles.errBox}>{error}</div>}

        <div className={styles.sectionTitle}>Leave requests — pending</div>
        {pendingLeave.length === 0 ? (
          <div className={styles.empty}>Nothing pending.</div>
        ) : (
          <div className={styles.list}>
            {pendingLeave.map((r) => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>{r.requester?.name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]}</div>
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
                    <div className={styles.cardTitle}>{r.requester?.name ?? 'Unknown'} — {EXPENSE_TYPE_LABELS[r.expense_type]} (₹{r.amount})</div>
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
                      <div className={styles.cardTitle}>{r.requester?.name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]}</div>
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
                      <div className={styles.cardTitle}>{r.requester?.name ?? 'Unknown'} — {EXPENSE_TYPE_LABELS[r.expense_type]} (₹{r.amount})</div>
                      <div className={styles.cardMeta}>{r.decided_by_user?.name ? `Decided by ${r.decided_by_user.name}` : ''}</div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
