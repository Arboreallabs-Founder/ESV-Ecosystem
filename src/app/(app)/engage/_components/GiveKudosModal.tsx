'use client'

import { useState, useTransition } from 'react'
import { giveKudos, type KudosInput } from '@/app/actions/kudos'
import type { KudosCategory } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../engage.module.css'

const CATEGORIES: KudosCategory[] = ['Teamwork', 'Leadership', 'Innovation', 'Above & Beyond', 'Customer Focus', 'Other']

export default function GiveKudosModal({ recipients, onClose, onSaved }: {
  recipients: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void
}) {
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<KudosCategory | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!recipientId) { setError('Please choose who this is for.'); return }
    if (!message.trim()) { setError('Message is required.'); return }
    const input: KudosInput = { recipient_id: recipientId, message, category: category || null }
    startTransition(async () => {
      try {
        await giveKudos(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Give kudos</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>For *</label>
            <select className={styles.select} value={recipientId} onChange={(e) => setRecipientId(e.target.value)} autoFocus>
              <option value="">Choose someone…</option>
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as KudosCategory)}>
              <option value="">No category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Message *</label>
            <textarea className={styles.textarea} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What did they do?" maxLength={500} />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Sending…</span> : 'Give kudos'}
          </button>
        </div>
      </div>
    </div>
  )
}
