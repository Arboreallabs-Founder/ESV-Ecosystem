'use client'

import { useState, useTransition } from 'react'
import type { DealCategory } from '@/lib/types'
import { createStandaloneDeal } from '@/app/actions/active-deals'
import Spinner from '@/app/_components/Spinner'
import styles from '../active-deals.module.css'

export default function NewDealModal({ categories, companyOptions, onClose, onCreated }: {
  categories: DealCategory[]
  companyOptions: Array<{ id: string; name: string }>
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const category = categories.find((c) => c.id === categoryId) ?? null
  const setValue = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }))

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Deal name is required.'); return }
    startTransition(async () => {
      try {
        await createStandaloneDeal({
          deal_name: name,
          category_id: categoryId || null,
          submitter_name: submitterName.trim() || null,
          submitter_email: submitterEmail.trim() || null,
          field_values: category ? values : {},
          company_id: companyId || null,
        })
        onCreated()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={`${styles.modalPanel} ${styles.modalPanelWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>New deal</div>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={`${styles.modalBody} ${styles.modalScroll}`}>
          <p className={styles.helpText} style={{ marginBottom: '0.25rem' }}>
            Add a portfolio or off-pipeline deal directly. It creates or links a company profile by name.
          </p>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Deal / company name *</label>
            <input className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Arboreal Labs" />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Company profile</label>
            <select className={styles.formSelect} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Create/link automatically by name</option>
              {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <div className={styles.helpText} style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
              Pick an existing profile now, or leave this blank to create or match one from the deal name.
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Category</label>
            <select className={styles.formSelect} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setValues({}) }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {category && category.fields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
              <div className={styles.formLabel} style={{ color: category.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', marginBottom: '0.6rem' }}>{category.name}</div>
              {category.fields.map((f) => (
                <div key={f.id} className={styles.formField}>
                  <label className={styles.formLabel}>{f.label}{f.required && ' *'}</label>
                  <input
                    className={styles.formInput}
                    value={values[f.id] ?? ''}
                    onChange={(e) => setValue(f.id, e.target.value)}
                    inputMode={f.field_type === 'numeric' || f.field_type === 'percentage' ? 'decimal' : undefined}
                    placeholder={f.field_type === 'url' ? 'https://' : f.field_type === 'percentage' ? '%' : f.field_type === 'numeric' ? 'Number (no commas)' : ''}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Contact name</label>
              <input className={styles.formInput} value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Contact email</label>
              <input className={styles.formInput} value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} />
            </div>
          </div>

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalActions} style={{ padding: '0.85rem 1.375rem', borderTop: '1px solid var(--color-border)' }}>
          <button className={styles.modalCancel} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.modalAccept} onClick={submit} disabled={pending}>
            {pending
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Creating…</span>
              : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
