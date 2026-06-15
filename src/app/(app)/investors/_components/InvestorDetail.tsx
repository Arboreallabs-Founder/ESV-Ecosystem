'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContact } from '@/app/actions/investors'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, InvestorContact, ServiceType } from '@/lib/types'
import ContactFormModal from './ContactFormModal'
import styles from '../investors.module.css'

function formatTicket(min: number | null, max: number | null): string {
  if (!min && !max) return '—'
  function fmt(n: number) {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(0)}Cr`
    if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`
    return `₹${n.toLocaleString('en-IN')}`
  }
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

const LINKEDIN_STATUS_COLOR: Record<string, string> = {
  Connected: '#16a34a',
  '1st': '#2563eb',
  '2nd': '#7c3aed',
  '3rd': '#d97706',
  Pending: '#64748b',
  'Not Connected': '#dc2626',
}

const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  vc_fund: 'var(--color-primary)',
  angel_fund: '#e07b39',
  family_office: '#2d8c6e',
  angel_investor: '#7b5ea7',
}

type Props = {
  investor: Investor
  userRole: string
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
}

export default function InvestorDetail({ investor, userRole, onClose, onEdit, onDeleted }: Props) {
  const router = useRouter()
  const [contacts, setContacts] = useState<InvestorContact[]>(investor.contacts ?? [])
  const [contactModal, setContactModal] = useState<{ mode: 'create' } | { mode: 'edit'; contact: InvestorContact } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canManage = ['founder', 'admin'].includes(userRole)
  const showContacts = investor.service_type !== 'angel_investor'
  const typeColor = SERVICE_TYPE_COLOR[investor.service_type]

  function handleDeleteInvestor() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const { deleteInvestor } = await import('@/app/actions/investors')
      await deleteInvestor(investor.id)
      router.refresh()
      onDeleted()
    })
  }

  function handleDeleteContact(contactId: string) {
    startTransition(async () => {
      await deleteContact(contactId)
      setContacts((cs) => cs.filter((c) => c.id !== contactId))
      router.refresh()
    })
  }

  return (
    <div className={styles.detailOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.detailPanel} onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>{investor.name}</div>
            <span className={styles.serviceTypeBadge}
              style={{ background: typeColor + '1a', color: typeColor }}>
              {SERVICE_TYPE_LABELS[investor.service_type]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            {canManage && (
              <>
                <button className={styles.detailActionBtn} onClick={onEdit}>Edit</button>
                <button
                  className={styles.detailDeleteBtn}
                  onClick={handleDeleteInvestor}
                  disabled={isPending}
                >
                  {confirmDelete ? 'Confirm Delete' : 'Delete'}
                </button>
              </>
            )}
            <button className={styles.detailClose} onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className={styles.detailBody}>

          {/* Overview */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>Overview</div>
            <div className={styles.detailGrid}>
              {investor.country && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Country</div>
                  <div className={styles.detailFieldValue}>{investor.country}</div>
                </div>
              )}
              {investor.website && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Website</div>
                  <div className={styles.detailFieldValue}>
                    <a href={investor.website} target="_blank" rel="noopener noreferrer"
                      className={styles.detailLink}>{investor.website.replace(/^https?:\/\//, '')}</a>
                  </div>
                </div>
              )}
              {investor.stage && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Stage</div>
                  <div className={styles.detailFieldValue}>{investor.stage}</div>
                </div>
              )}
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Ticket Size</div>
                <div className={styles.detailFieldValue}>
                  {formatTicket(investor.ticket_size_min, investor.ticket_size_max)}
                </div>
              </div>
              {investor.esv_poc?.name && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>ESV POC</div>
                  <div className={styles.detailFieldValue}>
                    <span className={styles.pocChip}>{investor.esv_poc.name}</span>
                  </div>
                </div>
              )}
              {investor.referred_by_partner?.name && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Referred By</div>
                  <div className={styles.detailFieldValue}>
                    <span className={styles.referredChip}>{investor.referred_by_partner.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sectors */}
          {investor.sectors.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Sectors</div>
              <div className={styles.sectorChipGroup}>
                {investor.sectors.map((s) => (
                  <span key={s} className={styles.sectorChip}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {showContacts && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Contacts ({contacts.length})</span>
                {(canManage || !canManage) && (
                  <button className={styles.addContactBtn}
                    onClick={() => setContactModal({ mode: 'create' })}>
                    + Add Contact
                  </button>
                )}
              </div>

              {contacts.length === 0 ? (
                <div className={styles.detailEmpty}>No contacts yet.</div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className={styles.contactRow}>
                    <div className={styles.contactRowMain}>
                      <div className={styles.contactName}>{c.name}</div>
                      {c.role && <div className={styles.contactRole}>{c.role}</div>}
                      <div className={styles.contactMeta}>
                        {c.linkedin_status && (
                          <span className={styles.linkedinStatusChip}
                            style={{
                              background: (LINKEDIN_STATUS_COLOR[c.linkedin_status] ?? '#64748b') + '1a',
                              color: LINKEDIN_STATUS_COLOR[c.linkedin_status] ?? '#64748b',
                            }}>
                            {c.linkedin_status}
                          </span>
                        )}
                        {c.email && <a href={`mailto:${c.email}`} className={styles.detailLink}>{c.email}</a>}
                        {c.phone && <span className={styles.contactPhone}>{c.phone}</span>}
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className={styles.detailLink}>LinkedIn ↗</a>
                        )}
                      </div>
                    </div>
                    <div className={styles.contactActions}>
                      <button className={styles.contactActionBtn}
                        onClick={() => setContactModal({ mode: 'edit', contact: c })}>Edit</button>
                      <button className={styles.contactActionBtn} disabled={isPending}
                        onClick={() => handleDeleteContact(c.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {contactModal && (
        <ContactFormModal
          investorId={investor.id}
          mode={contactModal.mode}
          initial={contactModal.mode === 'edit' ? contactModal.contact : undefined}
          onClose={() => setContactModal(null)}
          onSaved={(saved) => {
            setContacts((cs) =>
              contactModal.mode === 'create'
                ? [...cs, saved]
                : cs.map((c) => c.id === saved.id ? saved : c)
            )
            setContactModal(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
