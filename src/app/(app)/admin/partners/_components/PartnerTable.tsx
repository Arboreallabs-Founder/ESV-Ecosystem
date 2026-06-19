'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPartnerDetails, updatePartnerDetails } from '@/app/actions/partners'
import type { PartnerUser } from '@/lib/types'
import styles from '../../admin.module.css'

export default function PartnerTable({ partnerUsers }: { partnerUsers: PartnerUser[] }) {
  const router = useRouter()
  const [editTarget, setEditTarget] = useState<PartnerUser | null>(null)
  const [isPending, startTransition] = useTransition()

  const incompleteCount = partnerUsers.filter((u) => !u.franchise_partner_id).length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editTarget.franchise_partner_id) {
        await updatePartnerDetails(editTarget.franchise_partner_id, formData)
      } else {
        await upsertPartnerDetails(editTarget.id, formData)
      }
      setEditTarget(null)
      router.refresh()
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Franchise Partners</div>
          <div className={styles.pageSub}>
            {partnerUsers.length} partner{partnerUsers.length !== 1 ? 's' : ''}
            {' — '}create partner accounts in User Management
          </div>
        </div>
      </div>

      {incompleteCount > 0 && (
        <div style={{
          background: 'rgba(203,140,124,0.1)',
          border: '1.5px solid var(--color-warning)',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem 1.125rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-warning)',
        }}>
          <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>⚠</span>
          <span>
            {incompleteCount} partner{incompleteCount !== 1 ? 's are' : ' is'} missing details —
            click their name in User Management and fill in the agreement information.
          </span>
        </div>
      )}

      {partnerUsers.length === 0 ? (
        <div className={styles.empty}>
          No partners yet. Create a user with the Partner role in User Management, then fill in their details here.
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Firm Name</th>
                <th>Agreement</th>
                <th>Standard Fee Split</th>
                <th>Contract</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partnerUsers.map((u) => {
                const p = u.franchise_partners
                return (
                  <tr key={u.id}>
                    <td><div className={styles.name}>{u.name || '—'}</div></td>
                    <td>
                      <a className={styles.emailLink} href={`mailto:${u.email}`}>{u.email}</a>
                    </td>
                    <td>{p?.name || <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                    <td>{p?.agreement_type || <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                    <td>{p ? <span className={styles.feeSplit}>{p.success_fee_split_pct}%</span> : <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                    <td>
                      {p?.contract_link ? (
                        <a href={p.contract_link} target="_blank" rel="noopener noreferrer" className={styles.emailLink}>View</a>
                      ) : (
                        <span style={{ color: 'var(--color-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {!p ? (
                        <button
                          onClick={() => setEditTarget(u)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            border: '1.5px solid var(--color-warning)',
                            borderRadius: '6px',
                            background: 'rgba(203,140,124,0.08)',
                            color: 'var(--color-warning)',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Fill in details
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditTarget(u)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: '6px',
                            background: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
      </div>
      )}

      {editTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              {editTarget.franchise_partners ? 'Edit Partner Details' : 'Fill in Partner Details'}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.5rem' }}>
              {editTarget.name || editTarget.email}
            </p>
            <form onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>Firm Name *</label>
                <input
                  className={styles.input}
                  name="name"
                  required
                  defaultValue={editTarget.franchise_partners?.name || ''}
                  placeholder="e.g. Earlyseed Ventures"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Name *</label>
                <input
                  className={styles.input}
                  name="contact_name"
                  required
                  defaultValue={editTarget.franchise_partners?.contact_name || editTarget.name || ''}
                  placeholder="e.g. Robin S"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Email *</label>
                <input
                  className={styles.input}
                  name="contact_email"
                  type="email"
                  required
                  defaultValue={editTarget.franchise_partners?.contact_email || editTarget.email || ''}
                  placeholder="rahul@abc.com"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Agreement Type</label>
                <select
                  className={styles.select}
                  name="agreement_type"
                  defaultValue={editTarget.franchise_partners?.agreement_type || 'Standard'}
                >
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Standard Fee Split %</label>
                <input
                  className={styles.input}
                  name="success_fee_split_pct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={editTarget.franchise_partners?.success_fee_split_pct ?? 0}
                  placeholder="e.g. 30"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contract Link</label>
                <input
                  className={styles.input}
                  name="contract_link"
                  type="url"
                  defaultValue={editTarget.franchise_partners?.contract_link || ''}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
