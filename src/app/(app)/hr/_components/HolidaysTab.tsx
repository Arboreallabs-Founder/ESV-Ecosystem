'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createHoliday, updateHoliday, deleteHoliday, type HolidayInput } from '@/app/actions/holidays'
import type { Holiday } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../hr-zone.module.css'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function weekday(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HolidaysTab({ holidays, canEdit, canDelete }: {
  holidays: Holiday[]; canEdit: boolean; canDelete: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null)
  const [, startTransition] = useTransition()
  const now = today()

  // Grouped by calendar year because that is the unit the policy works in — the list is
  // published per year, and leave entitlement runs January to December.
  const byYear = useMemo(() => {
    const groups = new Map<string, Holiday[]>()
    for (const h of holidays) {
      const year = h.holiday_date.slice(0, 4)
      if (!groups.has(year)) groups.set(year, [])
      groups.get(year)!.push(h)
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [holidays])

  const nextUp = holidays.find((h) => h.holiday_date >= now)

  function handleDelete(id: string) {
    if (!confirm('Remove this day from the holiday calendar?')) return
    startTransition(async () => { await deleteHoliday(id); router.refresh() })
  }

  return (
    <div>
      <div className={styles.clockCard}>
        <div className={styles.clockCardHead} style={{ marginBottom: '0.5rem' }}>Holiday calendar</div>
        <div className={styles.pageSub} style={{ marginTop: 0, maxWidth: '60ch' }}>
          Days nobody is expected to work. Leave requests skip these and Sundays, so a holiday
          inside a leave range is never charged against a balance.
          {nextUp && <> Next up: <strong>{nextUp.name}</strong> on {formatDate(nextUp.holiday_date)}.</>}
        </div>
        {canEdit && (
          <button className={styles.primaryBtn} style={{ marginTop: '0.85rem' }} onClick={() => setEditing('new')}>
            + Add holiday
          </button>
        )}
      </div>

      {holidays.length === 0 ? (
        <div className={styles.empty}>
          No holidays on the calendar yet.<br />
          Until one is added, leave requests are counted excluding Sundays only.
        </div>
      ) : (
        byYear.map(([year, rows]) => (
          <div key={year} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.fieldLabel} style={{ marginBottom: '0.5rem' }}>
              {year} — {rows.length} {rows.length === 1 ? 'day' : 'days'}
            </div>
            <div className={styles.list}>
              {rows.map((h) => (
                <div
                  key={h.id}
                  className={styles.birthdayRow}
                  /* Past days stay listed — the calendar is the record of the year, not a
                     countdown — but they recede so the eye lands on what is still coming. */
                  style={h.holiday_date < now ? { opacity: 0.55 } : undefined}
                >
                  <span className={styles.birthdayName}>{h.name}</span>
                  {h.kind === 'company' && <span className={styles.policyCategoryPill}>Company</span>}
                  <span className={styles.birthdayDate}>{weekday(h.holiday_date)}, {formatDate(h.holiday_date)}</span>
                  {(canEdit || canDelete) && (
                    <div className={styles.policyActions}>
                      {canEdit && <button className={styles.iconBtn} onClick={() => setEditing(h)}>Edit</button>}
                      {canDelete && <button className={styles.iconBtn} onClick={() => handleDelete(h.id)}>Delete</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {editing && (
        <HolidayModal
          holiday={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function HolidayModal({ holiday, onClose, onSaved }: {
  holiday: Holiday | null; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(holiday?.name ?? '')
  const [date, setDate] = useState(holiday?.holiday_date ?? '')
  const [kind, setKind] = useState<'public' | 'company'>(holiday?.kind ?? 'public')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Holiday name is required.'); return }
    if (!date) { setError('Date is required.'); return }
    const input: HolidayInput = { name, holiday_date: date, kind }
    startTransition(async () => {
      try {
        if (holiday) await updateHoliday(holiday.id, input)
        else await createHoliday(input)
        onSaved()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{holiday ? 'Edit holiday' : 'Add holiday'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Date *</label>
            <input type="date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
            {date && <div className={styles.fieldHint}>{weekday(date)}</div>}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Occasion *</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Type</label>
            <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as 'public' | 'company')}>
              <option value="public">Festival / public holiday</option>
              <option value="company">Company closure</option>
            </select>
            <div className={styles.fieldHint}>
              Company closure is for a day declared mid-year, outside the list published in January.
            </div>
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : holiday ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
