'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createHrPolicy, updateHrPolicy, deleteHrPolicy, type HrPolicyInput } from '@/app/actions/hr-zone'
import type { HrPolicy } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../hr-zone.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PolicyRow({ policy, expanded, canEdit, canDelete, onToggle, onEdit, onDelete }: {
  policy: HrPolicy; expanded: boolean; canEdit: boolean; canDelete: boolean
  onToggle: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={styles.policy}>
      <div className={styles.policyHead} onClick={onToggle}>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>›</span>
        <span className={styles.policyTitle}>{policy.title}</span>
        {policy.category && <span className={styles.policyCategory}>{policy.category}</span>}
        {(canEdit || canDelete) && (
          <div className={styles.policyActions} onClick={(e) => e.stopPropagation()}>
            {canEdit && <button className={styles.iconBtn} onClick={onEdit} title="Edit">Edit</button>}
            {canDelete && <button className={styles.iconBtn} onClick={onDelete} title="Delete">Delete</button>}
          </div>
        )}
      </div>
      {expanded && (
        <div className={styles.policyBody}>
          {policy.body}
          <div className={styles.policyFoot}>
            Last updated {formatDate(policy.updated_at)}{policy.created_by_user?.name ? ` by ${policy.created_by_user.name}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HrZoneView({ policies, canEdit, canDelete }: { policies: HrPolicy[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<HrPolicy | 'new' | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Delete this policy?')) return
    startTransition(async () => { await deleteHrPolicy(id); router.refresh() })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>HR Zone</div>
            <WikiButton sectionKey="hr" />
          </div>
          <div className={styles.pageSub}>Company policies</div>
        </div>
        {canEdit && <button className={styles.primaryBtn} onClick={() => setEditing('new')}>+ New policy</button>}
      </div>

      <div className={styles.content}>
        {policies.length === 0 ? (
          <div className={styles.empty}>No policies published yet.</div>
        ) : (
          <div className={styles.list}>
            {policies.map((p) => (
              <PolicyRow
                key={p.id}
                policy={p}
                expanded={expandedId === p.id}
                canEdit={canEdit}
                canDelete={canDelete}
                onToggle={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                onEdit={() => setEditing(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <HrPolicyModal
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function HrPolicyModal({ policy, onClose, onSaved }: { policy: HrPolicy | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(policy?.title ?? '')
  const [category, setCategory] = useState(policy?.category ?? '')
  const [body, setBody] = useState(policy?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!body.trim()) { setError('Policy body is required.'); return }
    const input: HrPolicyInput = { title, category: category || null, body }
    startTransition(async () => {
      try {
        if (policy) await updateHrPolicy(policy.id, input)
        else await createHrPolicy(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{policy ? 'Edit policy' : 'New policy'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Leave Policy" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <input className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Leave, Conduct, Expenses" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Policy text *</label>
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the full policy…" />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : policy ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
