'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createStandaloneDeal } from '@/app/actions/active-deals'
import type { DealCategory } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../companies.module.css'

export default function CreateDealModal({ companyId, companyName, categories, onClose }: {
  companyId: string; companyName: string; categories: DealCategory[]; onClose: () => void
}) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const category = categories.find((c) => c.id === categoryId) ?? null
  const setValue = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }))

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await createStandaloneDeal({
          deal_name: companyName,
          category_id: categoryId || null,
          field_values: category ? values : {},
          company_id: companyId,
        })
        onClose()
        router.push('/active-deals')
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2 className={styles.modalTitle}>Create deal for {companyName}</h2><button className={styles.closeBtn} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <p className={styles.sectionText} style={{ marginBottom: '0.85rem' }}>
            Adds {companyName} to Active Deals, linked back to this profile.
          </p>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <select className={styles.select} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setValues({}) }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {category && category.fields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
              <div className={styles.fieldLabel} style={{ color: category.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', marginBottom: '0.6rem' }}>{category.name}</div>
              {category.fields.map((f) => (
                <div key={f.id} className={styles.field}>
                  <label className={styles.fieldLabel}>{f.label}{f.required && ' *'}</label>
                  <input
                    className={styles.input}
                    value={values[f.id] ?? ''}
                    onChange={(e) => setValue(f.id, e.target.value)}
                    inputMode={f.field_type === 'numeric' || f.field_type === 'percentage' ? 'decimal' : undefined}
                    placeholder={f.field_type === 'url' ? 'https://' : f.field_type === 'percentage' ? '%' : f.field_type === 'numeric' ? 'Number (no commas)' : ''}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Creating…</span> : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
