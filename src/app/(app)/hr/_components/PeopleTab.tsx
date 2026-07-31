'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveEmployeeProfile, saveCompensation } from '@/app/actions/employees'
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, COMPENSATION_COMPONENTS, BLOOD_GROUPS,
} from '@/lib/types'
import type { EmployeeRow, EmployeeCompensation, EmploymentType, UserRow } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import IdCard from '@/app/_components/IdCard'
import styles from '../hr-zone.module.css'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function fieldValue(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

/**
 * The People roster and profile editor — Phase 1 and 2 of the document module.
 *
 * Compensation is only rendered when `canSeeCompensation`; the RLS policy is what actually
 * protects it, but there is no reason to ship a salary panel to a browser that will only ever
 * receive an empty array.
 */
export default function PeopleTab({
  roster, compensation, canSeeCompensation, managers,
}: {
  roster: EmployeeRow[]
  /** userId -> their compensation history, newest first. Empty for anyone not permitted. */
  compensation: Record<string, EmployeeCompensation[]>
  canSeeCompensation: boolean
  managers: UserRow[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(roster[0]?.user.id ?? null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showCompForm, setShowCompForm] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((r) =>
      `${r.user.name ?? ''} ${r.user.email} ${r.profile?.employee_code ?? ''}`.toLowerCase().includes(q))
  }, [roster, search])

  const selected = roster.find((r) => r.user.id === selectedId) ?? null
  const history = selectedId ? (compensation[selectedId] ?? []) : []
  const current = history[0] ?? null

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    const fd = new FormData(e.currentTarget)
    setError(null); setSaved(false)

    startTransition(async () => {
      try {
        await saveEmployeeProfile(selected.user.id, {
          employee_code: fd.get('employee_code') as string,
          date_of_joining: fd.get('date_of_joining') as string,
          employment_type: (fd.get('employment_type') as EmploymentType) || null,
          probation_end_date: fd.get('probation_end_date') as string,
          confirmation_date: fd.get('confirmation_date') as string,
          reporting_manager_id: (fd.get('reporting_manager_id') as string) || null,
          work_location: fd.get('work_location') as string,
          notice_period_days: fd.get('notice_period_days') ? Number(fd.get('notice_period_days')) : null,
          date_of_exit: fd.get('date_of_exit') as string,
          exit_reason: fd.get('exit_reason') as string,
          legal_name: fd.get('legal_name') as string,
          date_of_birth: fd.get('date_of_birth') as string,
          residential_address: fd.get('residential_address') as string,
          personal_email: fd.get('personal_email') as string,
          emergency_contact_name: fd.get('emergency_contact_name') as string,
          emergency_contact_phone: fd.get('emergency_contact_phone') as string,
          blood_group: (fd.get('blood_group') as typeof BLOOD_GROUPS[number]) || null,
        })
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  function handleCompSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    const fd = new FormData(e.currentTarget)
    setError(null)

    const numOrNull = (k: string) => {
      const v = fd.get(k) as string
      return v?.trim() ? Number(v) : null
    }

    startTransition(async () => {
      try {
        await saveCompensation(selected.user.id, {
          effective_from: fd.get('effective_from') as string,
          annual_ctc: Number(fd.get('annual_ctc')),
          basic: numOrNull('basic'),
          hra: numOrNull('hra'),
          special_allowance: numOrNull('special_allowance'),
          employer_pf: numOrNull('employer_pf'),
          gratuity: numOrNull('gratuity'),
          variable_pay: numOrNull('variable_pay'),
          other_allowances: numOrNull('other_allowances'),
          notes: fd.get('notes') as string,
        })
        setShowCompForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  const p = selected?.profile

  return (
    <div className={styles.peopleLayout}>
      {/* ── Roster ── */}
      <aside className={styles.peopleList}>
        <input
          className={styles.peopleSearch}
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered.length === 0 ? (
          <div className={styles.empty}>No one matches.</div>
        ) : filtered.map((r) => (
          <button
            key={r.user.id}
            type="button"
            className={`${styles.peopleRow} ${r.user.id === selectedId ? styles.peopleRowActive : ''}`}
            onClick={() => { setSelectedId(r.user.id); setShowCompForm(false); setError(null) }}
          >
            <Avatar name={r.user.name} email={r.user.email} photoUrl={r.user.photo_url} size="md" />
            <span className={styles.peopleWho}>
              <span className={styles.peopleName}>{r.user.name || r.user.email}</span>
              <span className={styles.peopleMeta}>
                {r.profile?.employee_code || 'No employee code'}
                {r.profile?.date_of_exit ? ' · Exited' : ''}
              </span>
            </span>
            {/* A person with no profile can't have letters generated for them — flag it here
                rather than letting someone discover it at issue time. */}
            {!r.profile && <span className={styles.peopleFlag} title="No profile yet">!</span>}
          </button>
        ))}
      </aside>

      {/* ── Profile ── */}
      {!selected ? (
        <div className={styles.empty}>Select someone to see their profile.</div>
      ) : (
        <div className={styles.peopleDetail}>
          <div className={styles.peopleHead}>
            <Avatar name={selected.user.name} email={selected.user.email} photoUrl={selected.user.photo_url} size="lg" />
            <div>
              <div className={styles.peopleDetailName}>{selected.user.name || selected.user.email}</div>
              <div className={styles.peopleMeta}>{selected.user.designation || selected.user.role}</div>
            </div>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          <form onSubmit={handleProfileSubmit} key={selected.user.id}>
            <div className={styles.formSectionTitle}>Employment</div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Employee code</span>
                <input className={styles.input} name="employee_code" defaultValue={fieldValue(p?.employee_code)} placeholder="ESV-014" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Date of joining</span>
                <input className={styles.input} type="date" name="date_of_joining" defaultValue={fieldValue(p?.date_of_joining)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Employment type</span>
                <select className={styles.input} name="employment_type" defaultValue={fieldValue(p?.employment_type)}>
                  <option value="">—</option>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Reporting manager</span>
                <select className={styles.input} name="reporting_manager_id" defaultValue={fieldValue(p?.reporting_manager_id)}>
                  <option value="">—</option>
                  {managers.filter((m) => m.id !== selected.user.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Probation ends</span>
                <input className={styles.input} type="date" name="probation_end_date" defaultValue={fieldValue(p?.probation_end_date)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Confirmed on</span>
                <input className={styles.input} type="date" name="confirmation_date" defaultValue={fieldValue(p?.confirmation_date)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Work location</span>
                <input className={styles.input} name="work_location" defaultValue={fieldValue(p?.work_location)} placeholder="Mumbai" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Notice period (days)</span>
                <input className={styles.input} type="number" min={0} name="notice_period_days" defaultValue={fieldValue(p?.notice_period_days)} />
              </label>
            </div>

            <div className={styles.formSectionTitle}>Personal</div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Legal name</span>
                <input className={styles.input} name="legal_name" defaultValue={fieldValue(p?.legal_name)} placeholder="As on PAN" />
                <span className={styles.hint}>Letters must match the ID they present — often not the display name.</span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Date of birth</span>
                <input className={styles.input} type="date" name="date_of_birth" defaultValue={fieldValue(p?.date_of_birth)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Personal email</span>
                <input className={styles.input} type="email" name="personal_email" defaultValue={fieldValue(p?.personal_email)} />
                <span className={styles.hint}>Reachable after their work account closes.</span>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Residential address</span>
                <textarea className={styles.textarea} name="residential_address" rows={2} defaultValue={fieldValue(p?.residential_address)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Emergency contact</span>
                <input className={styles.input} name="emergency_contact_name" defaultValue={fieldValue(p?.emergency_contact_name)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Emergency phone</span>
                <input className={styles.input} name="emergency_contact_phone" defaultValue={fieldValue(p?.emergency_contact_phone)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Blood group</span>
                <select className={styles.input} name="blood_group" defaultValue={fieldValue(p?.blood_group)}>
                  <option value="">—</option>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <span className={styles.hint}>Printed on their ID card.</span>
              </label>
            </div>

            <div className={styles.formSectionTitle}>Exit</div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Date of exit</span>
                <input className={styles.input} type="date" name="date_of_exit" defaultValue={fieldValue(p?.date_of_exit)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Exit reason</span>
                <input className={styles.input} name="exit_reason" defaultValue={fieldValue(p?.exit_reason)} />
              </label>
            </div>

            <div className={styles.formActions}>
              {saved && <span className={styles.savedNote}>Saved ✓</span>}
              <button type="submit" className={styles.primaryBtn} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>

          {/* ── ID card ── */}
          <div className={styles.idCardSection}>
            <div className={styles.compHead}>
              <div>
                <div className={styles.formSectionTitle} style={{ marginTop: 0 }}>ID card</div>
                <div className={styles.hint}>
                  The photo is uploaded by the employee from their own Settings page — it is not
                  the profile avatar, which is often a mirrored LinkedIn headshot.
                </div>
              </div>
            </div>
            <IdCard
              name={selected.user.name || selected.user.email}
              designation={selected.user.designation}
              profile={selected.profile}
            />
          </div>

          {/* ── Compensation ── */}
          {canSeeCompensation && (
            <div className={styles.compSection}>
              <div className={styles.compHead}>
                <div>
                  <div className={styles.formSectionTitle} style={{ marginTop: 0 }}>Compensation</div>
                  <div className={styles.hint}>
                    Records are effective-dated and never overwritten, so a payslip for an earlier
                    month still reflects what was true then.
                  </div>
                </div>
                <button type="button" className={styles.ghostBtn} onClick={() => setShowCompForm((v) => !v)}>
                  {showCompForm ? 'Cancel' : '+ Add record'}
                </button>
              </div>

              {showCompForm && (
                <form onSubmit={handleCompSubmit} className={styles.compForm}>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Effective from *</span>
                      <input className={styles.input} type="date" name="effective_from" required />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Annual CTC (₹) *</span>
                      <input className={styles.input} type="number" min={0} step={1} name="annual_ctc" required />
                    </label>
                    {COMPENSATION_COMPONENTS.map((c) => (
                      <label key={c.key} className={styles.field}>
                        <span className={styles.label}>{c.label} (₹)</span>
                        <input className={styles.input} type="number" min={0} step={1} name={c.key} />
                      </label>
                    ))}
                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span className={styles.label}>Notes</span>
                      <input className={styles.input} name="notes" placeholder="e.g. annual increment, promotion to VP" />
                    </label>
                  </div>
                  <div className={styles.formActions}>
                    <button type="submit" className={styles.primaryBtn} disabled={isPending}>
                      {isPending ? 'Saving…' : 'Save record'}
                    </button>
                  </div>
                </form>
              )}

              {history.length === 0 ? (
                <div className={styles.empty}>No compensation recorded.</div>
              ) : (
                <div className={styles.compList}>
                  {history.map((c) => (
                    <div key={c.id} className={styles.compRow}>
                      <div className={styles.compMain}>
                        <span className={styles.compCtc}>{formatINR(Number(c.annual_ctc))}</span>
                        <span className={styles.compFrom}>
                          from {c.effective_from}
                          {c.id === current?.id && <span className={styles.compCurrent}>Current</span>}
                        </span>
                      </div>
                      {c.notes && <div className={styles.compNotes}>{c.notes}</div>}
                      <div className={styles.compParts}>
                        {COMPENSATION_COMPONENTS
                          .filter((k) => c[k.key] != null)
                          .map((k) => (
                            <span key={k.key} className={styles.compPart}>
                              {k.label} {formatINR(Number(c[k.key]))}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
