'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { withdrawLeaveRequest } from '@/app/actions/leave-requests'
import { withdrawExpenseRequest } from '@/app/actions/expense-requests'
import { LEAVE_TYPE_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/types'
import type { LeaveRequest, ExpenseRequest, LeaveBalance } from '@/lib/types'
import LeaveRequestModal from './LeaveRequestModal'
import ExpenseRequestModal from './ExpenseRequestModal'
import styles from '../hr-zone.module.css'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const cls = status === 'approved' ? styles.statusApproved : status === 'rejected' ? styles.statusRejected : styles.statusPending
  return <span className={`${styles.statusPill} ${cls}`}>{status}</span>
}

export default function MyRequests({ leaveRequests, expenseRequests, leaveBalances, orgId, userId }: {
  leaveRequests: LeaveRequest[]; expenseRequests: ExpenseRequest[]; leaveBalances: Record<string, LeaveBalance> | null
  orgId: string; userId: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'leave' | 'expense'>('leave')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [, startTransition] = useTransition()

  function handleWithdrawLeave(id: string) {
    if (!confirm('Withdraw this leave request?')) return
    startTransition(async () => { await withdrawLeaveRequest(id); router.refresh() })
  }
  function handleWithdrawExpense(id: string) {
    if (!confirm('Withdraw this expense request?')) return
    startTransition(async () => { await withdrawExpenseRequest(id); router.refresh() })
  }

  return (
    <div className={styles.clockCard}>
      <div className={styles.clockCardHead}>
        <div className={styles.requestTabs}>
          <button className={`${styles.requestTab} ${tab === 'leave' ? styles.requestTabActive : ''}`} onClick={() => setTab('leave')}>Leave</button>
          <button className={`${styles.requestTab} ${tab === 'expense' ? styles.requestTabActive : ''}`} onClick={() => setTab('expense')}>Expenses</button>
        </div>
        {tab === 'leave'
          ? <button className={styles.ghostBtn} onClick={() => setShowLeaveModal(true)} style={{ marginLeft: 'auto' }}>+ Request leave</button>
          : <button className={styles.ghostBtn} onClick={() => setShowExpenseModal(true)} style={{ marginLeft: 'auto' }}>+ Submit expense</button>}
      </div>

      {tab === 'leave' ? (
        leaveRequests.length === 0 ? (
          <div className={styles.empty}>No leave requests yet.</div>
        ) : (
          <div className={styles.list}>
            {leaveRequests.map((r) => (
              <div key={r.id} className={styles.birthdayRow}>
                <span className={styles.birthdayName}>{LEAVE_TYPE_LABELS[r.leave_type]}</span>
                <span className={styles.birthdayDate}>{formatDate(r.start_date)} – {formatDate(r.end_date)}</span>
                <StatusPill status={r.status} />
                {r.status === 'pending' && (
                  <button className={styles.iconBtn} onClick={() => handleWithdrawLeave(r.id)}>Withdraw</button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        expenseRequests.length === 0 ? (
          <div className={styles.empty}>No expense requests yet.</div>
        ) : (
          <div className={styles.list}>
            {expenseRequests.map((r) => (
              <div key={r.id} className={styles.birthdayRow}>
                <span className={styles.birthdayName}>{EXPENSE_TYPE_LABELS[r.expense_type]}</span>
                <span className={styles.birthdayDate}>₹{r.amount}</span>
                {r.invoice_signed_url && (
                  <a href={r.invoice_signed_url} target="_blank" rel="noopener noreferrer" className={styles.iconBtn}>Invoice</a>
                )}
                <StatusPill status={r.status} />
                {r.status === 'pending' && (
                  <button className={styles.iconBtn} onClick={() => handleWithdrawExpense(r.id)}>Withdraw</button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {showLeaveModal && (
        <LeaveRequestModal balances={leaveBalances} onClose={() => setShowLeaveModal(false)} onSaved={() => { setShowLeaveModal(false); router.refresh() }} />
      )}
      {showExpenseModal && (
        <ExpenseRequestModal
          orgId={orgId}
          userId={userId}
          onClose={() => setShowExpenseModal(false)}
          onSaved={() => { setShowExpenseModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
