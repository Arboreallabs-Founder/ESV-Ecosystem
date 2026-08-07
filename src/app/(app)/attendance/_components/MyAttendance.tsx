'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AttendanceStatement } from '@/lib/types'
import { ATTENDANCE_LINE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/lib/types'
import { monthLabel, totalLeaveDays } from '@/lib/attendance-format'
import { approveStatement, disputeStatement } from '@/app/actions/attendance'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../attendance.module.css'

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

/** The employee side: read the month, then approve it or say what is wrong. */
export default function MyAttendance({ statements }: { statements: AttendanceStatement[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [disputeFor, setDisputeFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  function run(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); setDisputeFor(null); setNote(''); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    })
  }

  const open = statements.filter((s) => s.status === 'sent')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>My attendance</h1>
          <p className={styles.pageSub}>
            HR sends a statement each month before payroll. Check it and either approve it or say
            what is wrong — your answer is recorded against the month.
          </p>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {open.length > 0 && (
        <div className={styles.callout}>
          {open.length === 1
            ? `${monthLabel(open[0].period_month)} is waiting for your approval.`
            : `${open.length} months are waiting for your approval.`}
        </div>
      )}

      {statements.length === 0 ? (
        <div className={panels.chartEmpty}>
          Nothing yet. Statements appear here once HR sends the month.
        </div>
      ) : (
        <div className={styles.list}>
          {statements.map((st) => {
            const total = totalLeaveDays(st.lines)
            const canAct = st.status === 'sent' || st.status === 'approved' || st.status === 'disputed'
            return (
              <section key={st.id} className={panels.panel}>
                <div className={styles.rowHead}>
                  <div>
                    <div className={styles.whoName}>{monthLabel(st.period_month)}</div>
                    <div className={styles.whoMeta}>
                      {total} day{total === 1 ? '' : 's'} chargeable leave · {st.lines.length} entr{st.lines.length === 1 ? 'y' : 'ies'}
                    </div>
                  </div>
                  <span className={`${styles.pill} ${
                    st.status === 'disputed' ? styles.pillDisputed
                    : st.status === 'approved' ? styles.pillApproved
                    : st.status === 'locked' ? styles.pillLocked
                    : styles.pillSent}`}
                  >
                    {ATTENDANCE_STATUS_LABELS[st.status]}
                  </span>
                </div>

                {st.lines.length === 0 ? (
                  <div className={panels.chartEmpty}>Nothing recorded — a clean month.</div>
                ) : (
                  <div className={panels.tableScroll}>
                    <table className={panels.overviewTable}>
                      <thead>
                        <tr><th>Date</th><th>What</th><th>Detail</th><th>Source</th><th className={styles.num}>Leave</th></tr>
                      </thead>
                      <tbody>
                        {st.lines.map((l) => (
                          <tr key={l.id} className={l.waived ? styles.waivedRow : undefined}>
                            <td>{fmtDay(l.entry_date)}</td>
                            <td>{ATTENDANCE_LINE_LABELS[l.line_type]}</td>
                            <td className={styles.muted}>
                              {l.detail ?? '—'}
                              {l.waived && <span className={styles.waivedTag}>Considered — {l.waived_reason}</span>}
                            </td>
                            <td>
                              {/* You are being asked to approve this, so you get told which lines
                                  came from the app's records and which a person typed. */}
                              <span className={l.source === 'auto' ? styles.srcAuto : styles.srcManual}>
                                {l.source === 'auto' ? 'From records' : 'Entered by HR'}
                              </span>
                            </td>
                            <td className={styles.num}>{l.waived ? '—' : l.leave_days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {st.deduction_note && (
                  <p className={panels.panelFoot}>Deduction: {st.deduction_note}</p>
                )}
                {st.status === 'disputed' && (
                  <div className={styles.disputeBox}>
                    <strong>You disputed this.</strong> {st.dispute_note}
                    {st.resolution_note && <div className={styles.resolved}>HR: {st.resolution_note}</div>}
                  </div>
                )}
                {st.status === 'locked' && st.locked_without_approval && (
                  <p className={panels.panelFoot}>
                    Payroll was processed before this was approved. Raise it with HR if it is wrong.
                  </p>
                )}

                {canAct && st.status !== 'locked' && (
                  <div className={styles.actRow}>
                    {st.status !== 'approved' && (
                      <button className={styles.approveBtn} disabled={pending} onClick={() => run(() => approveStatement(st.id))}>
                        Approve
                      </button>
                    )}
                    {disputeFor === st.id ? (
                      <>
                        <input
                          className={panels.tableSearch}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Which date, and what it should say"
                          autoFocus
                        />
                        <button className={panels.tableReset} disabled={pending || note.trim().length < 5} onClick={() => run(() => disputeStatement(st.id, note))}>
                          Submit
                        </button>
                        <button className={panels.tableReset} onClick={() => { setDisputeFor(null); setNote('') }}>Cancel</button>
                      </>
                    ) : (
                      <button className={panels.tableReset} disabled={pending} onClick={() => setDisputeFor(st.id)}>
                        Dispute
                      </button>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
