'use client'

import { useState, useTransition } from 'react'
import { createProject } from '@/app/actions/projects'
import { describeError } from '@/lib/client-errors'
import PeoplePicker, { type PickablePerson } from '@/app/_components/PeoplePicker'
import { SERVICES, SERVICE_META, type ProjectService } from '@/lib/project-model'
import styles from '../projects.module.css'

/** A new lead. Only the name is required; the company is linked or created from it, since every
    lead goes into Companies whether or not they take the proposal. */
export default function NewProjectModal({ people, companyOptions, userId, onClose, onCreated }: {
  people: PickablePerson[]
  companyOptions: Array<{ id: string; name: string }>
  userId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [connect, setConnect] = useState<string[]>([userId])
  const [lead, setLead] = useState<string[]>([])
  const [services, setServices] = useState<ProjectService[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function pickCompany(id: string) {
    setCompanyId(id)
    const c = companyOptions.find((o) => o.id === id)
    if (c && !name.trim()) setName(c.name)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        const id = await createProject({ name, companyId: companyId || null, connectIds: connect, leadIds: lead, services, notes })
        onCreated(id)
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>New project</div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Existing company</label>
            <select className={styles.formInput} value={companyId} onChange={(e) => pickCompany(e.target.value)}>
              <option value="">New company (created from the name below)</option>
              {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Project name *</label>
            <input className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Usually the company, e.g. Grounded Cafe" autoFocus />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Connect <span className={styles.formHint}>who brought the lead in</span></label>
            <PeoplePicker people={people} value={connect} onChange={setConnect} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Project lead</label>
            <PeoplePicker people={people} value={lead} onChange={setLead} placeholder="Pick later if you’re not sure yet" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Services they’re interested in <span className={styles.formHint}>optional, priced at the proposal stage</span></label>
            <div className={styles.checkChips}>
              {SERVICES.filter((s) => s !== 'custom').map((s) => (
                <label key={s} className={`${styles.checkChip} ${services.includes(s) ? styles.checkChipOn : ''}`}>
                  <input type="checkbox" checked={services.includes(s)}
                         onChange={(e) => setServices((prev) => e.target.checked ? [...prev, s] : prev.filter((x) => x !== s))} />
                  {SERVICE_META[s].label}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Notes</label>
            <textarea className={styles.formInput} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How they came to us, what they need, anything useful for the call" />
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}
