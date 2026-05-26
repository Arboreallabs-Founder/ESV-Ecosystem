'use client'

import { useState, useTransition } from 'react'
import { createDeal } from '@/app/actions/deals'
import styles from '../kanban.module.css'

const SECTORS = ['Technology', 'Fintech', 'Healthcare', 'Real Estate', 'Consumer', 'B2B SaaS', 'Media', 'EdTech', 'Other']
const FUNDING_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Other']
const SOURCES = ['Direct', 'Franchise Partner', 'Network', 'Event', 'Inbound', 'JotForm', 'Other']

export default function NewDealModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState<string | null>(null)
  const [forceCreate, setForceCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const companyName = (formData.get('company_name') as string).trim()
    if (!companyName) { setError('Company name is required.'); return }

    startTransition(async () => {
      try {
        const result = await createDeal(formData, forceCreate)
        if (result?.duplicate && !forceCreate) {
          setDupWarning(`A deal for "${companyName}" already exists. Create anyway?`)
          setForceCreate(true)
          return
        }
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create deal.')
      }
    })
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New Deal</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {error && <div className={styles.errorMsg} style={{ marginBottom: '1rem' }}>{error}</div>}
        {dupWarning && (
          <div className={styles.errorMsg} style={{ marginBottom: '1rem', background: 'rgba(203,140,124,0.12)', color: 'var(--color-warning)' }}>
            ⚠ {dupWarning}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.field} style={{ gridColumn: '1/-1' }}>
              <label className={styles.label} htmlFor="company_name">Company Name *</label>
              <input id="company_name" name="company_name" className={styles.input} placeholder="e.g. Acme Corp" required disabled={isPending} onChange={() => { setDupWarning(null); setForceCreate(false) }} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="founder_name">Founder Name</label>
              <input id="founder_name" name="founder_name" className={styles.input} placeholder="Full name" disabled={isPending} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="founder_email">Founder Email</label>
              <input id="founder_email" name="founder_email" type="email" className={styles.input} placeholder="founder@startup.com" disabled={isPending} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="sector">Sector</label>
              <select id="sector" name="sector" className={styles.select} disabled={isPending} defaultValue="Technology">
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="funding_stage">Funding Stage</label>
              <select id="funding_stage" name="funding_stage" className={styles.select} disabled={isPending} defaultValue="Seed">
                {FUNDING_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className={styles.field} style={{ gridColumn: '1/-1' }}>
              <label className={styles.label} htmlFor="source">Source</label>
              <select id="source" name="source" className={styles.select} disabled={isPending} defaultValue="Direct">
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isPending}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending}>
              {isPending ? 'Creating…' : forceCreate ? 'Create Anyway' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
