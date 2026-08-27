'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateClockSettings, createBirthday, updateBirthday, deleteBirthday,
  type ClockSettingsInput, type BirthdayInput,
} from '@/app/actions/hr-clock'
import type { HrClockSettings, HrBirthday } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../hr-zone.module.css'

function formatDob(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// TIME columns come back as 'HH:MM:SS' — <input type="time"> wants 'HH:MM'.
function toInputTime(time: string) {
  return time.slice(0, 5)
}

export default function HrClockAdmin({ settings, birthdays, canEdit, canDelete }: {
  settings: HrClockSettings; birthdays: HrBirthday[]; canEdit: boolean; canDelete: boolean
}) {
  const router = useRouter()
  const [times, setTimes] = useState<ClockSettingsInput>({
    clock_in_start: toInputTime(settings.clock_in_start),
    clock_in_end: toInputTime(settings.clock_in_end),
    clock_out_start: toInputTime(settings.clock_out_start),
    clock_out_end: toInputTime(settings.clock_out_end),
  })
  const [savingTimes, startSavingTimes] = useTransition()
  const [timesError, setTimesError] = useState<string | null>(null)
  const [addingBirthday, setAddingBirthday] = useState(false)

  function saveTimes() {
    setTimesError(null)
    startSavingTimes(async () => {
      try {
        await updateClockSettings(times)
        router.refresh()
      } catch (e) {
        setTimesError(describeError(e).message)
      }
    })
  }

  function handleDeleteBirthday(id: string) {
    if (!confirm('Delete this birthday?')) return
    startSavingTimes(async () => { await deleteBirthday(id); router.refresh() })
  }

  return (
    <div className={styles.clockCard}>
      <div className={styles.clockCardHead}>Clock reminders</div>
      <div className={styles.clockGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Clock In starts</label>
          <input
            className={styles.input} type="time" disabled={!canEdit}
            value={times.clock_in_start}
            onChange={(e) => setTimes((t) => ({ ...t, clock_in_start: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Clock In ends</label>
          <input
            className={styles.input} type="time" disabled={!canEdit}
            value={times.clock_in_end}
            onChange={(e) => setTimes((t) => ({ ...t, clock_in_end: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Clock Out starts</label>
          <input
            className={styles.input} type="time" disabled={!canEdit}
            value={times.clock_out_start}
            onChange={(e) => setTimes((t) => ({ ...t, clock_out_start: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Clock Out ends</label>
          <input
            className={styles.input} type="time" disabled={!canEdit}
            value={times.clock_out_end}
            onChange={(e) => setTimes((t) => ({ ...t, clock_out_end: e.target.value }))}
          />
        </div>
      </div>
      {timesError && <div className={styles.errBox}>{timesError}</div>}
      {canEdit && (
        <button className={styles.ghostBtn} onClick={saveTimes} disabled={savingTimes} style={{ marginTop: '0.75rem' }}>
          {savingTimes ? 'Saving…' : 'Save times'}
        </button>
      )}

      <div className={styles.clockCardHead} style={{ marginTop: '1.5rem' }}>
        Birthdays
        {canEdit && (
          <button className={styles.iconBtn} onClick={() => setAddingBirthday(true)} title="Add birthday" style={{ marginLeft: 'auto' }}>
            + Add
          </button>
        )}
      </div>
      {birthdays.length === 0 ? (
        <div className={styles.empty}>No birthdays recorded yet.</div>
      ) : (
        <div className={styles.list}>
          {birthdays.map((b) => (
            <BirthdayRow
              key={b.id}
              birthday={b}
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={() => handleDeleteBirthday(b.id)}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {addingBirthday && (
        <BirthdayModal onClose={() => setAddingBirthday(false)} onSaved={() => { setAddingBirthday(false); router.refresh() }} />
      )}
    </div>
  )
}

function BirthdayRow({ birthday, canEdit, canDelete, onDelete, onSaved }: {
  birthday: HrBirthday; canEdit: boolean; canDelete: boolean; onDelete: () => void; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className={styles.birthdayRow}>
      <span className={styles.birthdayName}>{birthday.name}</span>
      <span className={styles.birthdayDate}>{formatDob(birthday.birth_date)}</span>
      {(canEdit || canDelete) && (
        <div className={styles.policyActions}>
          {canEdit && <button className={styles.iconBtn} onClick={() => setEditing(true)}>Edit</button>}
          {canDelete && <button className={styles.iconBtn} onClick={onDelete}>Delete</button>}
        </div>
      )}
      {editing && (
        <BirthdayModal birthday={birthday} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved() }} />
      )}
    </div>
  )
}

function BirthdayModal({ birthday, onClose, onSaved }: {
  birthday?: HrBirthday; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(birthday?.name ?? '')
  const [date, setDate] = useState(birthday?.birth_date.slice(0, 10) ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Name is required.'); return }
    if (!date) { setError('Date of birth is required.'); return }
    const input: BirthdayInput = { name, birth_date: date }
    startTransition(async () => {
      try {
        if (birthday) await updateBirthday(birthday.id, input)
        else await createBirthday(input)
        onSaved()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{birthday ? 'Edit birthday' : 'Add birthday'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Name *</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Priya Sharma" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Date of birth *</label>
            <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : birthday ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
