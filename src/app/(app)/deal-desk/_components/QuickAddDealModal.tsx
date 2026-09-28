'use client'

import { useState, useTransition } from 'react'
import { createDeskDeal } from '@/app/actions/deal-desk'
import { describeError } from '@/lib/client-errors'
import Spinner from '@/app/_components/Spinner'
import styles from './deal-desk.module.css'

/**
 * Log one deal by hand — the associate-side sibling of the "+ Add a company" form on
 * /my-companies. Only the name is required: the point is to capture a lead the moment you hear
 * about it, not to make a spreadsheet row first. CSV import stays for a batch of post-call
 * summaries; this is for the one you want on the board right now.
 */
export default function QuickAddDealModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [location, setLocation] = useState('')
  const [about, setAbout] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await createDeskDeal({
          company_name: name, sector: sector || null, location: location || null,
          about: about || null, notes: notes || null,
        })
        setSaved(true)
        onAdded()
      } catch (err) {
        setError(describeError(err).message)
      }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Log a deal</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          {saved ? (
            <div className={styles.okBox}><strong>{name}</strong> added to your board.</div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Company name *</label>
                <input
                  className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
                  required autoFocus maxLength={40} placeholder="What are they called?"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Sector</label>
                <input className={styles.input} value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. Fintech" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Location</label>
                <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={50} placeholder="e.g. Mumbai" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>About</label>
                <input
                  className={styles.input} value={about} onChange={(e) => setAbout(e.target.value)}
                  maxLength={50} placeholder="One line — what they do"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Notes</label>
                <textarea
                  className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="How you heard about them, why they're interesting, what came up on the call — anything worth remembering before you fill in the rest."
                />
              </div>
              {error && <div className={styles.errBox}>{error}</div>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)' }}>
          {saved ? (
            <button className={styles.primaryBtn} onClick={onClose}>Done</button>
          ) : (
            <>
              <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primaryBtn} onClick={submit} disabled={pending || !name.trim()}>
                {pending
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Adding…</span>
                  : 'Add deal'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
