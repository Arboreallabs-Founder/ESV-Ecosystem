'use client'

import { useState, useTransition } from 'react'
import {
  createCategory, updateCategory, deleteCategory,
  addCategoryField, updateCategoryField, deleteCategoryField,
} from '@/app/actions/active-deals'
import type { DealCategory, DealCategoryField } from '@/lib/types'
import styles from '../../admin.module.css'
import catStyles from './categories.module.css'

const PRESET_COLORS = [
  '#745FFD', '#16a34a', '#2563eb', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#ea580c',
]

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  numeric: 'Numeric',
  percentage: 'Percentage (%)',
  url: 'URL (https)',
}

type FieldDraft = { label: string; field_type: 'text' | 'numeric' | 'percentage' | 'url'; required: boolean }

export default function CategoriesManager({ initialCategories }: { initialCategories: DealCategory[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [isPending, startTransition] = useTransition()

  // Category modal state
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DealCategory | null>(null)
  const [catName, setCatName] = useState('')
  const [catDesc, setCatDesc] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])
  const [catError, setCatError] = useState('')

  // Per-category field adding state (categoryId → draft)
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({})
  const [editingField, setEditingField] = useState<{ fieldId: string; label: string; field_type: string; required: boolean } | null>(null)
  const [fieldError, setFieldError] = useState('')

  function openAdd() {
    setEditTarget(null); setCatName(''); setCatDesc(''); setCatColor(PRESET_COLORS[0]); setCatError(''); setShowModal(true)
  }
  function openEdit(c: DealCategory) {
    setEditTarget(c); setCatName(c.name); setCatDesc(c.description ?? ''); setCatColor(c.color); setCatError(''); setShowModal(true)
  }

  function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catName.trim()) return
    setCatError('')
    startTransition(async () => {
      try {
        if (editTarget) {
          await updateCategory(editTarget.id, catName, catDesc, catColor)
          setCategories((prev) => prev.map((c) => c.id === editTarget.id ? { ...c, name: catName.trim(), description: catDesc.trim() || null, color: catColor } : c))
        } else {
          const id = await createCategory(catName, catDesc, catColor)
          setCategories((prev) => [...prev, { id, name: catName.trim(), description: catDesc.trim() || null, color: catColor, created_at: new Date().toISOString(), fields: [] }])
        }
        setShowModal(false)
      } catch (err) { setCatError(String(err)) }
    })
  }

  function handleDeleteCategory(c: DealCategory) {
    if (!confirm(`Delete category "${c.name}"? This will remove it from all active deals.`)) return
    startTransition(async () => {
      await deleteCategory(c.id)
      setCategories((prev) => prev.filter((cat) => cat.id !== c.id))
    })
  }

  function getFieldDraft(categoryId: string): FieldDraft {
    return fieldDrafts[categoryId] ?? { label: '', field_type: 'text', required: false }
  }
  function setFieldDraft(categoryId: string, patch: Partial<FieldDraft>) {
    setFieldDrafts((prev) => ({ ...prev, [categoryId]: { ...getFieldDraft(categoryId), ...patch } }))
  }

  function handleAddField(categoryId: string) {
    const draft = getFieldDraft(categoryId)
    if (!draft.label.trim()) return
    setFieldError('')
    const position = categories.find((c) => c.id === categoryId)?.fields.length ?? 0
    startTransition(async () => {
      try {
        const fieldId = await addCategoryField(categoryId, draft.label, draft.field_type, draft.required, position)
        const newField: DealCategoryField = { id: fieldId, category_id: categoryId, label: draft.label.trim(), field_type: draft.field_type, required: draft.required, position }
        setCategories((prev) => prev.map((c) => c.id === categoryId ? { ...c, fields: [...c.fields, newField] } : c))
        setFieldDrafts((prev) => ({ ...prev, [categoryId]: { label: '', field_type: 'text', required: false } }))
      } catch (err) { setFieldError(String(err)) }
    })
  }

  function handleDeleteField(categoryId: string, fieldId: string) {
    startTransition(async () => {
      await deleteCategoryField(fieldId)
      setCategories((prev) => prev.map((c) => c.id === categoryId ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c))
    })
  }

  function openEditField(f: DealCategoryField) {
    setEditingField({ fieldId: f.id, label: f.label, field_type: f.field_type, required: f.required })
    setFieldError('')
  }

  function handleSaveField(categoryId: string) {
    if (!editingField || !editingField.label.trim()) return
    setFieldError('')
    startTransition(async () => {
      try {
        await updateCategoryField(editingField.fieldId, editingField.label, editingField.field_type as any, editingField.required)
        setCategories((prev) => prev.map((c) => c.id === categoryId ? {
          ...c,
          fields: c.fields.map((f) => f.id === editingField.fieldId ? { ...f, label: editingField.label.trim(), field_type: editingField.field_type as any, required: editingField.required } : f),
        } : c))
        setEditingField(null)
      } catch (err) { setFieldError(String(err)) }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Deal Categories</div>
          <div className={styles.pageSub}>{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} — define the buckets active deals fall into</div>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>+ New Category</button>
      </div>

      {categories.length === 0 ? (
        <div className={catStyles.empty}>
          No categories yet. Create one to start tagging active deals with structured data fields.
        </div>
      ) : (
        <div className={catStyles.list}>
          {categories.map((cat) => {
            const draft = getFieldDraft(cat.id)
            return (
              <div key={cat.id} className={catStyles.catCard}>
                <div className={catStyles.catHeader}>
                  <div className={catStyles.catLeft}>
                    <span className={catStyles.colorDot} style={{ background: cat.color }} />
                    <div>
                      <div className={catStyles.catName}>{cat.name}</div>
                      {cat.description && <div className={catStyles.catDesc}>{cat.description}</div>}
                    </div>
                  </div>
                  <div className={catStyles.catActions}>
                    <button className={catStyles.editBtn} onClick={() => openEdit(cat)}>Edit</button>
                    <button className={catStyles.deleteBtn} onClick={() => handleDeleteCategory(cat)}>Delete</button>
                  </div>
                </div>

                {/* Fields list */}
                <div className={catStyles.fieldsSection}>
                  <div className={catStyles.fieldsSectionLabel}>Data Fields</div>
                  {cat.fields.length === 0 && (
                    <div className={catStyles.noFields}>No fields yet — add one below.</div>
                  )}
                  {cat.fields.map((f) => (
                    <div key={f.id} className={catStyles.fieldRow}>
                      {editingField?.fieldId === f.id ? (
                        <>
                          <input
                            className={catStyles.fieldInput}
                            value={editingField.label}
                            onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                            autoFocus
                          />
                          <select
                            className={catStyles.fieldSelect}
                            value={editingField.field_type}
                            onChange={(e) => setEditingField({ ...editingField, field_type: e.target.value })}
                          >
                            {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <label className={catStyles.reqToggle}>
                            <input type="checkbox" checked={editingField.required} onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })} />
                            Required
                          </label>
                          <button className={catStyles.saveFieldBtn} onClick={() => handleSaveField(cat.id)} disabled={isPending}>Save</button>
                          <button className={catStyles.cancelFieldBtn} onClick={() => setEditingField(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <span className={catStyles.fieldLabel}>{f.label}{f.required && <span className={catStyles.reqStar}> *</span>}</span>
                          <span className={catStyles.fieldType}>{FIELD_TYPE_LABELS[f.field_type]}</span>
                          <button className={catStyles.editBtn} onClick={() => openEditField(f)}>Edit</button>
                          <button className={catStyles.deleteBtn} onClick={() => handleDeleteField(cat.id, f.id)}>Remove</button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add field row */}
                  <div className={catStyles.addFieldRow}>
                    <input
                      className={catStyles.fieldInput}
                      placeholder="Field label (e.g. ARR)"
                      value={draft.label}
                      onChange={(e) => setFieldDraft(cat.id, { label: e.target.value })}
                    />
                    <select
                      className={catStyles.fieldSelect}
                      value={draft.field_type}
                      onChange={(e) => setFieldDraft(cat.id, { field_type: e.target.value as any })}
                    >
                      {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <label className={catStyles.reqToggle}>
                      <input type="checkbox" checked={draft.required} onChange={(e) => setFieldDraft(cat.id, { required: e.target.checked })} />
                      Required
                    </label>
                    <button
                      className={catStyles.addFieldBtn}
                      onClick={() => handleAddField(cat.id)}
                      disabled={!draft.label.trim() || isPending}
                    >
                      + Add Field
                    </button>
                  </div>
                  {fieldError && <p className={catStyles.fieldError}>{fieldError}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !isPending && setShowModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{editTarget ? 'Edit Category' : 'New Category'}</div>
            <form onSubmit={handleSaveCategory}>
              <div className={styles.field}>
                <label className={styles.label}>Name *</label>
                <input className={styles.input} value={catName} onChange={(e) => setCatName(e.target.value)} required autoFocus placeholder="e.g. SaaS Portfolio" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <input className={styles.input} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Optional — shown on the active deals page" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Colour</label>
                <div className={catStyles.colorPicker}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={catStyles.colorSwatch}
                      style={{ background: c, outline: catColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }}
                      onClick={() => setCatColor(c)}
                    />
                  ))}
                </div>
              </div>
              {catError && <p className={styles.errorMsg}>{catError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)} disabled={isPending}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>{isPending ? 'Saving…' : editTarget ? 'Save' : 'Create Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
