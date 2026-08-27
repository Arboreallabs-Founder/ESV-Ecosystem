'use client'

import { describeError } from '@/lib/client-errors'
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
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleCategory(id: string, checked: boolean) {
    setCategoryIds((prev) => checked ? [...prev, id] : prev.filter((c) => c !== id))
  }

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Deal name is required.'); return }
    startTransition(async () => {
      try {
        await createStandaloneDeal({
          deal_name: name,
          selections: categoryIds.map((id) => ({ category_id: id, field_values: values[id] ?? {} })),
          submitter_name: submitterName.trim() || null,
          submitter_email: submitterEmail.trim() || null,
          company_id: companyId || null,
        })
        onCreated()
      } catch (e) { setError(describeError(e).message) }
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

          {categories.length > 0 && (
            <div className={styles.formField}>
              <label className={styles.formLabel}>Categories <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
              <div className={styles.categoryCheckList}>
                {categories.map((cat) => (
                  <label key={cat.id} className={styles.categoryCheckRow}>
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(cat.id)}
                      onChange={(e) => toggleCategory(cat.id, e.target.checked)}
                    />
                    <span className={styles.catCheckDot} style={{ background: cat.color }} />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {categoryIds.map((catId) => {
            const cat = categories.find((c) => c.id === catId)
            if (!cat || cat.fields.length === 0) return null
            return (
              <div key={catId} className={styles.acceptFieldGroup}>
                <div className={styles.acceptFieldGroupLabel} style={{ color: cat.color }}>{cat.name}</div>
                {cat.fields.map((f) => (
                  <div key={f.id} className={styles.formField}>
                    <label className={styles.formLabel}>{f.label}{f.required && ' *'}</label>
                    <input
                      className={styles.formInput}
                      value={values[catId]?.[f.id] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [catId]: { ...prev[catId], [f.id]: e.target.value } }))}
                      inputMode={f.field_type === 'numeric' || f.field_type === 'percentage' ? 'decimal' : undefined}
                      placeholder={f.field_type === 'url' ? 'https://' : f.field_type === 'percentage' ? '%' : f.field_type === 'numeric' ? 'Number (no commas)' : ''}
                    />
                  </div>
                ))}
              </div>
            )
          })}

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
