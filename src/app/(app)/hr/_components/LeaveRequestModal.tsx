'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useMemo, useTransition } from 'react'
import { createLeaveRequest, type LeaveRequestInput } from '@/app/actions/leave-requests'
import { LEAVE_TYPE_LABELS, type LeaveType, type LeaveBalance, type Holiday } from '@/lib/types'
import { workingDays, nonWorkingDaysIn } from '@/lib/working-days'
import Spinner from '@/app/_components/Spinner'
import styles from '../hr-zone.module.css'

const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]

export default function LeaveRequestModal({ balances, holidays, onClose, onSaved }: {
  balances: Record<string, LeaveBalance> | null; holidays: Holiday[]
  onClose: () => void; onSaved: () => void
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('earned')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const holidayDates = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays])
  const holidayNames = useMemo(() => new Map(holidays.map((h) => [h.holiday_date, h.name])), [holidays])

  /* What this request will actually cost. The same rules the balance uses (lib/working-days.ts),
     shown before submitting rather than discovered afterwards — the gap between "I booked four
     days" and "three were deducted" is where leave disputes start. */
  const cost = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null
    const singleDay = startDate === endDate
    const days = workingDays(startDate, endDate, holidayDates, singleDay && isHalfDay)
    const skipped = nonWorkingDaysIn(startDate, endDate, holidayDates)
    return { days, skipped }
  }, [startDate, endDate, isHalfDay, holidayDates])

  function describeSkipped(dates: string[]): string {
    const named = dates.map((d) => holidayNames.get(d)).filter(Boolean) as string[]
    const sundays = dates.length - named.length
    const parts: string[] = []
    if (sundays > 0) parts.push(`${sundays} Sunday${sundays === 1 ? '' : 's'}`)
    parts.push(...named)
    return parts.join(', ')
  }

  function submit() {
    setError(null)
    if (!startDate || !endDate) { setError('Start and end dates are required.'); return }
    if (endDate < startDate) { setError('End date cannot be before the start date.'); return }
    const singleDay = startDate === endDate
    const input: LeaveRequestInput = {
      leave_type: leaveType, start_date: startDate, end_date: endDate,
      is_half_day: singleDay && isHalfDay, reason: reason || null,
    }
    startTransition(async () => {
      try {
        await createLeaveRequest(input)
        onSaved()
      } catch (e) { setError(describeError(e).message) }
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
            {/* Only shown once HR has actually configured a balance for this type — avoids a
                misleading "0 of 0" for anyone (e.g. founders) with no balance tracked at all. */}
            {balances?.[leaveType] && balances[leaveType].entitled_days > 0 && (
              <div className={styles.birthdayDate} style={{ marginTop: '0.4rem' }}>
                Remaining: {balances[leaveType].remaining} of {balances[leaveType].entitled_days} days (informational only)
              </div>
            )}
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
          {startDate !== '' && startDate === endDate && (
            <div className={styles.field}>
              <label className={styles.halfDayRow}>
                <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} />
                Half day (counts as 0.5)
              </label>
            </div>
          )}
          {cost && (
            <div className={styles.costNote}>
              {cost.days === 0 ? (
                <>These dates are all non-working days — <strong>nothing will be deducted</strong>.</>
              ) : (
                <>This request counts as <strong>{cost.days} {cost.days === 1 ? 'day' : 'days'}</strong>.</>
              )}
              {cost.skipped.length > 0 && <> Not counted: {describeSkipped(cost.skipped)}.</>}
            </div>
          )}
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
