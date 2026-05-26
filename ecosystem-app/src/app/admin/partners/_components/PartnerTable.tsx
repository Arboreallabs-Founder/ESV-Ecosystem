'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPartner, linkPartnerToUser } from '@/app/actions/partners'
import type { FranchisePartner, UserRow } from '@/lib/types'
import styles from '../../admin.module.css'

export default function PartnerTable({
  partners: initialPartners,
  users,
}: {
  partners: FranchisePartner[]
  users: UserRow[]
}) {
  const router = useRouter()
  const [partners, setPartners] = useState(initialPartners)
  const [showModal, setShowModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<FranchisePartner | null>(null)
  const [isPending, startTransition] = useTransition()

  const unlinkedPartnerUsers = users.filter(
    (u) => u.role === 'franchise_partner' && !u.franchise_partner_id,
  )

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createPartner(formData)
      setShowModal(false)
      router.refresh()
    })
  }

  function handleLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!showLinkModal) return
    const formData = new FormData(e.currentTarget)
    const userId = formData.get('user_id') as string
    startTransition(async () => {
      await linkPartnerToUser(userId, showLinkModal.id)
      setShowLinkModal(null)
      router.refresh()
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Franchise Partners</div>
          <div className={styles.pageSub}>{partners.length} partner{partners.length !== 1 ? 's' : ''}</div>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add Partner</button>
      </div>

      <div className={styles.tableWrap}>
        {partners.length === 0 ? (
          <div className={styles.empty}>No franchise partners yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Agreement</th>
                <th>Fixed Fee</th>
                <th>Variable Split</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const linkedUser = users.find((u) => u.franchise_partner_id === p.id)
                return (
                  <tr key={p.id}>
                    <td><div className={styles.name}>{p.name}</div></td>
                    <td>{p.contact_name}</td>
                    <td>
                      <a className={styles.emailLink} href={`mailto:${p.contact_email}`}>
                        {p.contact_email}
                      </a>
                    </td>
                    <td>{p.agreement_type}</td>
                    <td><span className={styles.feeSplit}>₹{Number(p.fixed_fee || 0).toLocaleString('en-IN')}</span></td>
                    <td><span className={styles.feeSplit}>{p.fee_split_pct}%</span></td>
                    <td>
                      {linkedUser ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
                          Linked to {linkedUser.name || linkedUser.email}
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowLinkModal(p)}
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
                          Link User
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Add Franchise Partner</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Partner / Firm Name *</label>
                <input className={styles.input} name="name" required placeholder="ABC Advisors" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Name *</label>
                <input className={styles.input} name="contact_name" required placeholder="Rahul Mehta" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Email *</label>
                <input className={styles.input} name="contact_email" type="email" required placeholder="rahul@abc.com" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Agreement Type</label>
                <select className={styles.select} name="agreement_type" defaultValue="Standard">
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Fixed Fee per Deal (₹)</label>
                <input className={styles.input} name="fixed_fee" type="number" min="0" defaultValue="0" placeholder="e.g. 50000" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Variable Fee Split % of Success Fee</label>
                <input className={styles.input} name="fee_split_pct" type="number" min="0" max="100" defaultValue="20" placeholder="e.g. 20" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '-0.5rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                The split % can be overridden on a per-deal basis. Both fees apply per successfully closed deal.
              </p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Add Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowLinkModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Link User to {showLinkModal.name}</div>
            <form onSubmit={handleLink}>
              <div className={styles.field}>
                <label className={styles.label}>Select franchise_partner user</label>
                <select className={styles.select} name="user_id" required>
                  <option value="">Select…</option>
                  {unlinkedPartnerUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              {unlinkedPartnerUsers.length === 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
                  No unlinked franchise_partner users found. Create a user with the franchise_partner role first.
                </p>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowLinkModal(null)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending || unlinkedPartnerUsers.length === 0}>
                  {isPending ? 'Linking…' : 'Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
