'use client'

import { useState, useTransition } from 'react'
import { addContact, updateContact } from '@/app/actions/investors'
import { LINKEDIN_STATUS_OPTIONS } from '@/lib/types'
import type { InvestorContact } from '@/lib/types'
import styles from '../investors.module.css'

type Props = {
  investorId: string
  initial?: InvestorContact
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (contact: InvestorContact) => void
}

export default function ContactFormModal({ investorId, initial, mode, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    linkedin_url: initial?.linkedin_url ?? '',
    linkedin_status: initial?.linkedin_status ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
  })

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const draft = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      linkedin_status: form.linkedin_status || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      sort_order: initial?.sort_order ?? 0,
    }
    startTransition(async () => {
      if (mode === 'create') {
        const saved = await addContact(investorId, draft)
        onSaved(saved)
      } else {
        await updateContact(initial!.id, draft)
        onSaved({ ...initial!, ...draft } as InvestorContact)
      }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{mode === 'create' ? 'Add Contact' : 'Edit Contact'}</div>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Name *</label>
            <input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Role / Title</label>
              <input className={styles.input} value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Partner, MD, etc." />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>LinkedIn Status</label>
              <select className={styles.select} value={form.linkedin_status} onChange={(e) => set('linkedin_status', e.target.value)}>
                <option value="">—</option>
                {LINKEDIN_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <input className={styles.input} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>LinkedIn URL</label>
            <input className={styles.input} type="url" value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/…" />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending || !form.name.trim()}>
              {isPending ? 'Saving…' : mode === 'create' ? 'Add Contact' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
