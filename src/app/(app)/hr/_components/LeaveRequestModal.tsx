'use client'

import { useState, useTransition } from 'react'
import { createLeaveRequest, type LeaveRequestInput } from '@/app/actions/leave-requests'
import { LEAVE_TYPE_LABELS, type LeaveType } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../hr-zone.module.css'

const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]

export default function LeaveRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [leaveType, setLeaveType] = useState<LeaveType>('earned')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!startDate || !endDate) { setError('Start and end dates are required.'); return }
    if (endDate < startDate) { setError('End date cannot be before the start date.'); return }
    const input: LeaveRequestInput = { leave_type: leaveType, start_date: startDate, end_date: endDate, reason: reason || null }
    startTransition(async () => {
      try {
        await createLeaveRequest(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Request leave</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Leave type *</label>
            <select className={styles.input} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className={styles.clockGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Start date *</label>
              <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>End date *</label>
              <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Reason</label>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional details…" style={{ minHeight: '100px' }} />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Submitting…</span> : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  )
}
