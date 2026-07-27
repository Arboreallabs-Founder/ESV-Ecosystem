'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createExpenseRequest, type ExpenseRequestInput } from '@/app/actions/expense-requests'
import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../hr-zone.module.css'

const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]

export default function ExpenseRequestModal({ orgId, userId, onClose, onSaved }: {
  orgId: string; userId: string; onClose: () => void; onSaved: () => void
}) {
  const [expenseType, setExpenseType] = useState<ExpenseType>('travel')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [invoice, setInvoice] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount.'); return }
    if (!invoice) { setError('Please attach an invoice.'); return }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const ext = invoice.name.split('.').pop() || 'pdf'
        const path = `${orgId}/expenses/${userId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('expenses').upload(path, invoice)
        if (upErr) throw new Error(upErr.message)

        const input: ExpenseRequestInput = {
          expense_type: expenseType, amount: amountNum, description: description || null, invoice_path: path,
        }
        await createExpenseRequest(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Submit expense</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.clockGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Expense type *</label>
              <select className={styles.input} value={expenseType} onChange={(e) => setExpenseType(e.target.value as ExpenseType)}>
                {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Amount (₹) *</label>
              <input className={styles.input} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1500" />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" style={{ minHeight: '90px' }} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Invoice *</label>
            <input className={styles.input} type="file" accept="image/*,.pdf" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Submitting…</span> : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  )
}
