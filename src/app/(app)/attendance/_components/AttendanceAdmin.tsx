'use client'

import { describeError } from '@/lib/client-errors'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AttendanceLineType, AttendanceStatement } from '@/lib/types'
import { ATTENDANCE_LINE_LABELS, ATTENDANCE_LINE_TYPES, ATTENDANCE_STATUS_LABELS } from '@/lib/types'
import { monthLabel, totalLeaveDays } from '@/lib/attendance-format'
import {
  addLine, deleteLine, lockStatement, openMonthForAll, pullFromRecords,
  reopenStatement, resolveDispute, sendStatement, setLineWaived, setStatementNotes,
} from '@/app/actions/attendance'
import Avatar from '@/app/_components/Avatar'
import MyAttendance from './MyAttendance'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../attendance.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

type Person = { id: string; name: string; photo_url: string | null }

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

export default function AttendanceAdmin({
  period, months, statements, roster, tab, myStatements,
}: {
  period: string
  months: string[]
  statements: AttendanceStatement[]
  roster: Person[]
  currentUserId: string
  tab: 'team' | 'mine'
  myStatements: AttendanceStatement[]
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const byUser = useMemo(
    () => new Map(statements.map((s) => [s.user_id, s])),
    [statements],
  )
  const missing = roster.filter((p) => !byUser.has(p.id))

  function run(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (err) { setError(describeError(err).message) }
    })
  }

  const counts = {
    awaiting: statements.filter((s) => s.status === 'sent').length,
    disputed: statements.filter((s) => s.status === 'disputed').length,
    approved: statements.filter((s) => s.status === 'approved').length,
    locked: statements.filter((s) => s.status === 'locked').length,
  }

  // Managers are employees too. Their own month waits for them exactly like everyone else's, and
  // the badge is there because the first version gave them no way to reach it at all.
  const myOpen = myStatements.filter((s) => s.status === 'sent').length

  const tabs = (
    <div className={styles.tabs} role="tablist">
      <button
        role="tab"
        aria-selected={tab === 'team'}
        className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`}
        onClick={() => router.push('/attendance')}
      >
        Team
      </button>
      <button
        role="tab"
        aria-selected={tab === 'mine'}
        className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`}
        onClick={() => router.push('/attendance?tab=mine')}
      >
        My attendance
        {myOpen > 0 && <span className={styles.tabCount}>{myOpen}</span>}
      </button>
    </div>
  )

  if (tab === 'mine') {
    return (
      <div className={styles.page}>
        {tabs}
        <MyAttendance statements={myStatements} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {tabs}
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.pageTitle}>Attendance</h1>
            <WikiButton sectionKey="attendanceHr" />
          </div>
          <p className={styles.pageSub}>
            The monthly statement each person approves before payroll. Leave, WFH and events come
            from the app&apos;s own records; late logins, missed punch-outs, half days and Saturdays
            are entered here — nothing in the app records a punch.
          </p>
        </div>
        <select
          className={panels.tableSelect}
          value={period}
          onChange={(e) => router.push(`/attendance?month=${e.target.value}`)}
          aria-label="Month"
        >
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={panels.panel}>
        <div className={panels.panelHead}>
          <h2 className={panels.panelTitle}>{monthLabel(period)}</h2>
          {missing.length > 0 && (
            <button
              className={panels.panelLink}
              disabled={pending}
              onClick={() => run(() => openMonthForAll(missing.map((p) => p.id), period))}
            >
              Open the month for {missing.length} more
            </button>
          )}
        </div>
        <div className={panels.kpiStrip}>
          <Tile label="Awaiting approval" value={counts.awaiting} foot="Sent, not yet answered" />
          <Tile label="Disputed" value={counts.disputed} foot="Needs settling before payroll" />
          <Tile label="Approved" value={counts.approved} foot="Employee has confirmed" />
          <Tile label="Locked" value={counts.locked} foot="Payroll processed" />
          <Tile label="Not started" value={missing.length} foot="No statement this month" />
        </div>
      </section>

      {statements.length === 0 && missing.length === 0 ? (
        <div className={panels.chartEmpty}>No staff on the roster.</div>
      ) : (
        <div className={styles.list}>
          {roster.map((p) => {
            const st = byUser.get(p.id)
            const isOpen = st ? openId === st.id : false
            const total = st ? totalLeaveDays(st.lines) : 0
            return (
              <section key={p.id} className={panels.panel}>
                <div className={styles.rowHead}>
                  <div className={styles.who}>
                    <Avatar name={p.name} photoUrl={p.photo_url} size="sm" />
                    <div>
                      <div className={styles.whoName}>{p.name}</div>
                      <div className={styles.whoMeta}>
                        {st
                          ? `${st.lines.length} entr${st.lines.length === 1 ? 'y' : 'ies'} · ${total} day${total === 1 ? '' : 's'} leave`
                          : 'No statement yet'}
                      </div>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    {st ? <StatusPill s={st} /> : <span className={styles.pillNone}>Not started</span>}
                    {st ? (
                      <button className={panels.tableReset} onClick={() => setOpenId(isOpen ? null : st.id)}>
                        {isOpen ? 'Close' : 'Open'}
                      </button>
                    ) : (
                      <button
                        className={panels.tableReset}
                        disabled={pending}
                        onClick={() => run(() => openMonthForAll([p.id], period))}
                      >
                        Start
                      </button>
                    )}
                  </div>
                </div>

                {st && isOpen && (
                  <StatementEditor statement={st} pending={pending} run={run} />
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, foot }: { label: string; value: number; foot: string }) {
  return (
    <div className={panels.kpi}>
      <div className={panels.kpiLabel}>{label}</div>
      <div className={panels.kpiValue}>{value}</div>
      <span className={panels.kpiFoot}>{foot}</span>
    </div>
  )
}

function StatusPill({ s }: { s: AttendanceStatement }) {
  // The word carries the meaning; colour is emphasis only.
  const cls =
    s.status === 'disputed' ? styles.pillDisputed
    : s.status === 'approved' ? styles.pillApproved
    : s.status === 'locked' ? styles.pillLocked
    : s.status === 'sent' ? styles.pillSent
    : styles.pillDraft
  return (
    <span className={`${styles.pill} ${cls}`}>
      {ATTENDANCE_STATUS_LABELS[s.status]}
      {s.status === 'locked' && s.locked_without_approval ? ' · unapproved' : ''}
    </span>
  )
}

function StatementEditor({
  statement: st, pending, run,
}: {
  statement: AttendanceStatement
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const editable = st.status === 'draft' || st.status === 'disputed'
  const [date, setDate] = useState('')
  const [type, setType] = useState<AttendanceLineType>('late_login')
  const [detail, setDetail] = useState('')
  const [days, setDays] = useState('0')
  const [deduction, setDeduction] = useState(st.deduction_note ?? '')
  const [resolution, setResolution] = useState('')

  const total = totalLeaveDays(st.lines)
  const autoCount = st.lines.filter((l) => l.source === 'auto').length

  return (
    <div className={styles.editor}>
      {st.status === 'disputed' && (
        <div className={styles.disputeBox}>
          <strong>Disputed.</strong> {st.dispute_note}
          {st.resolution_note && <div className={styles.resolved}>Settled: {st.resolution_note}</div>}
          {!st.resolution_note && (
            <div className={styles.resolveRow}>
              <input
                className={panels.tableSearch}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="What was agreed?"
              />
              <button
                className={panels.tableReset}
                disabled={pending || !resolution.trim()}
                onClick={() => run(() => resolveDispute(st.id, resolution))}
              >
                Record outcome
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.editorBar}>
        <span className={styles.totalChip}>{total} day{total === 1 ? '' : 's'} chargeable</span>
        <span className={styles.autoChip}>{autoCount} from records</span>
        <div className={styles.spacer} />
        {editable && (
          <button className={panels.tableReset} disabled={pending} onClick={() => run(() => pullFromRecords(st.id))}>
            Pull from records
          </button>
        )}
        {editable && (
          <button className={panels.tableReset} disabled={pending} onClick={() => run(() => sendStatement(st.id))}>
            Send to employee
          </button>
        )}
        {(st.status === 'sent' || st.status === 'approved' || st.status === 'disputed') && (
          <button className={panels.tableReset} disabled={pending} onClick={() => run(() => reopenStatement(st.id))}>
            Reopen
          </button>
        )}
        {(st.status === 'sent' || st.status === 'approved') && (
          <button
            className={panels.tableReset}
            disabled={pending}
            onClick={() => {
              if (st.status !== 'approved' && !confirm(
                'This has not been approved yet. Locking is allowed, and the statement will record '
                + 'that it was locked without approval. Continue?')) return
              run(() => lockStatement(st.id))
            }}
          >
            Lock for payroll
          </button>
        )}
      </div>

      {st.lines.length === 0 ? (
        <div className={panels.chartEmpty}>Nothing recorded — a clean month.</div>
      ) : (
        <div className={panels.tableScroll}>
          <table className={panels.overviewTable}>
            <thead>
              <tr>
                <th>Date</th><th>What</th><th>Detail</th><th>Source</th>
                <th className={styles.num}>Leave</th><th></th>
              </tr>
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
                    {/* Spelled out, not a colour: an employee reading this needs to know which
                        numbers came from the app and which someone typed. */}
                    <span className={l.source === 'auto' ? styles.srcAuto : styles.srcManual}>
                      {l.source === 'auto' ? 'From records' : 'Entered by HR'}
                    </span>
                  </td>
                  <td className={styles.num}>{l.waived ? '—' : l.leave_days}</td>
                  <td className={styles.num}>
                    {editable && (
                      <>
                        <button
                          className={styles.miniBtn}
                          disabled={pending}
                          onClick={() => {
                            if (l.waived) return run(() => setLineWaived(l.id, false, ''))
                            const why = prompt('Why is this being waived?')
                            if (why?.trim()) run(() => setLineWaived(l.id, true, why))
                          }}
                        >
                          {l.waived ? 'Charge' : 'Consider'}
                        </button>
                        <button className={styles.miniBtn} disabled={pending} onClick={() => run(() => deleteLine(l.id))}>
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <div className={styles.addRow}>
          <input className={panels.tableSelect} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <select className={panels.tableSelect} value={type} onChange={(e) => setType(e.target.value as AttendanceLineType)} aria-label="Type">
            {ATTENDANCE_LINE_TYPES.map((t) => <option key={t} value={t}>{ATTENDANCE_LINE_LABELS[t]}</option>)}
          </select>
          <input className={panels.tableSearch} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detail — e.g. 2.00 pm (2nd half)" />
          <input className={panels.tableSelect} style={{ width: 90 }} type="number" step="0.5" min="0" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Leave days" />
          <button
            className={panels.tableReset}
            disabled={pending || !date}
            onClick={() => run(async () => {
              await addLine(st.id, { entry_date: date, line_type: type, detail, leave_days: Number(days) || 0 })
              setDate(''); setDetail(''); setDays('0')
            })}
          >
            Add
          </button>
        </div>
      )}

      <div className={styles.addRow}>
        <input
          className={panels.tableSearch}
          value={deduction}
          onChange={(e) => setDeduction(e.target.value)}
          placeholder="Deduction of leave / salary — a note, not an amount"
          disabled={!editable}
        />
        <button
          className={panels.tableReset}
          disabled={pending || !editable}
          onClick={() => run(() => setStatementNotes(st.id, { deduction_note: deduction }))}
        >
          Save note
        </button>
      </div>
    </div>
  )
}
