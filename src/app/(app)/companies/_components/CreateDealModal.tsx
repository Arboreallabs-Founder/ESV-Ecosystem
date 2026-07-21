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
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleCategory(id: string, checked: boolean) {
    setCategoryIds((prev) => checked ? [...prev, id] : prev.filter((c) => c !== id))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await createStandaloneDeal({
          deal_name: companyName,
          selections: categoryIds.map((id) => ({ category_id: id, field_values: values[id] ?? {} })),
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

          {categories.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Categories <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
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
                  <div key={f.id} className={styles.field}>
                    <label className={styles.fieldLabel}>{f.label}{f.required && ' *'}</label>
                    <input
                      className={styles.input}
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
