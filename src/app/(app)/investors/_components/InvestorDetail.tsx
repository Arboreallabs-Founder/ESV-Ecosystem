'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteContact, getInvestorPortfolio } from '@/app/actions/investors'
import { DEAL_STATE_META, SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, InvestorContact, InvestorPortfolioItem, ServiceType } from '@/lib/types'
import { countryFlagCode } from '@/lib/countries'
import ContactFormModal from './ContactFormModal'
import styles from '../investors.module.css'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

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


const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  vc_fund: 'var(--color-primary)',
  angel_fund: '#e07b39',
  family_office: '#2d8c6e',
  angel_investor: '#7b5ea7',
  debt_fund: '#b03a2e',
  corporate_vc: '#2e6f95',
  private_equity: '#5c4a72',
  growth_equity: '#3f7d4f',
  fund_of_funds: '#8a6d3b',
  accelerator: '#c77d2e',
  sovereign_wealth: '#4a5a75',
  merchant_bank: '#6b4226',
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
  // Partners may edit their own referrals (they only ever see their own via RLS) but not delete.
  // Associates can edit investor details too, same as founder/admin — just never delete.
  // HR owns relationship management, so it edits (and imports) like an associate — but, like
  // associates, never deletes. See docs/ROLES.md "Investors & Partners - HR access".
  const canEdit = canManage || ['associate', 'hr', 'franchise_partner'].includes(userRole)
  const isInternal = ['founder', 'admin', 'associate', 'hr'].includes(userRole)
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
            {investor.username && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.35rem' }}>@{investor.username}</div>}
            <span className={styles.serviceTypeBadge}
              style={{ background: typeColor + '1a', color: typeColor }}>
              {SERVICE_TYPE_LABELS[investor.service_type]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            {/* The overlay stays the quick look; the portfolio and POC audit need a page. */}
            <Link href={`/investors/${investor.id}`} className={styles.detailActionBtn}
              style={{ textDecoration: 'none' }}>
              Full profile
            </Link>
            {canEdit && (
              <button className={styles.detailActionBtn} onClick={onEdit}>Edit</button>
            )}
            {canManage && (
              <button
                className={styles.detailDeleteBtn}
                onClick={handleDeleteInvestor}
                disabled={isPending}
              >
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </button>
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
                  <div className={styles.detailFieldValue} style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem' }}>
                    {countryFlagCode(investor.country) && <span className={`fi fi-${countryFlagCode(investor.country)} ${styles.countryFlag}`} />}
                    {investor.country}
                    {investor.country !== 'India' && <span className={styles.foreignBadge}>Foreign</span>}
                  </div>
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
              {(investor.esv_pocs ?? []).length > 0 && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>ESV POC</div>
                  <div className={`${styles.detailFieldValue} ${styles.pocChipRow}`}>
                    {investor.esv_pocs!.map((poc) => (
                      <span key={poc.id} className={styles.pocChip}>{poc.name}</span>
                    ))}
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

          {/* Onboarding + KYC — angel investors only */}
          {investor.service_type === 'angel_investor' && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Onboarding &amp; KYC</div>
              <div className={styles.detailGrid}>
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Onboarding Form</div>
                  <div className={styles.detailFieldValue}>
                    <span className={investor.onboarding_form_completed ? styles.statusYes : styles.statusNo}>
                      {investor.onboarding_form_completed ? 'Completed' : 'Not completed'}
                    </span>
                  </div>
                </div>
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>KYC</div>
                  <div className={styles.detailFieldValue}>
                    <span className={investor.kyc_done ? styles.statusYes : styles.statusNo}>
                      {investor.kyc_done ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
                {investor.onboarding_form_url && (
                  <div className={styles.detailField}>
                    <div className={styles.detailFieldLabel}>Signed Form</div>
                    <div className={styles.detailFieldValue}>
                      <a href={investor.onboarding_form_url} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>View signed form ↗</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Business Types + other thesis tags */}
          {(investor.business_types.length > 0 || investor.meta_tags.length > 0) && (
            <div className={styles.detailSection}>
              {investor.business_types.length > 0 && (
                <div style={{ marginBottom: investor.meta_tags.length > 0 ? '0.75rem' : 0 }}>
                  <div className={styles.detailFieldLabel} style={{ marginBottom: '0.4rem' }}>Business Types</div>
                  <div className={styles.sectorChipGroup}>
                    {investor.business_types.map((t) => (
                      <span key={t} className={styles.sectorChip}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {investor.meta_tags.length > 0 && (
                <div>
                  <div className={styles.detailFieldLabel} style={{ marginBottom: '0.4rem' }}>Other Thesis Tags</div>
                  <div className={styles.sectorChipGroup}>
                    {investor.meta_tags.map((t) => (
                      <span key={t} className={styles.sectorChip}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Investment History — deals invested in, with the company's tags */}
          <InvestorPortfolioSection investorId={investor.id} declaredTags={[...investor.sectors, ...investor.business_types, ...investor.meta_tags]} />

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
                        {c.email && <a href={`mailto:${c.email}`} className={styles.detailLink}>{c.email}</a>}
                        {c.phone && <span className={styles.contactPhone}>{c.phone}</span>}
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className={styles.detailLink}>LinkedIn ↗</a>
                        )}
                      </div>
                    </div>
                    {isInternal && (
                      <div className={styles.contactActions}>
                        <button className={styles.contactActionBtn}
                          onClick={() => setContactModal({ mode: 'edit', contact: c })}>Edit</button>
                        <button className={styles.contactActionBtn} disabled={isPending}
                          onClick={() => handleDeleteContact(c.id)}>Delete</button>
                      </div>
                    )}
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

// Deals this investor is attached to, with the linked company's tags — doubles as a
// computed "inferred interests" view (tags seen across their portfolio that aren't yet
// part of their stated Sectors / Business Types / Other Tags).
function InvestorPortfolioSection({ investorId, declaredTags }: { investorId: string; declaredTags: string[] }) {
  const [items, setItems] = useState<InvestorPortfolioItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getInvestorPortfolio(investorId).then((data) => { if (!cancelled) setItems(data) })
    return () => { cancelled = true }
  }, [investorId])

  if (items === null) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Investment History</div>
        <div className={styles.detailEmpty}>Loading…</div>
      </div>
    )
  }
  if (items.length === 0) return null

  const declaredSet = new Set(declaredTags.map((t) => t.toLowerCase()))
  const tagCounts = new Map<string, number>()
  for (const item of items) {
    for (const tag of [...item.company_sectors, ...item.company_meta_tags]) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const inferredTags = [...tagCounts.entries()]
    .filter(([tag]) => !declaredSet.has(tag.toLowerCase()))
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      {inferredTags.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>
            Inferred Interests <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(from invested companies, not in stated tags)</span>
          </div>
          <div className={styles.sectorChipGroup}>
            {inferredTags.map(([tag, count]) => (
              <span key={tag} className={styles.pocChip} title={`Seen in ${count} invested compan${count === 1 ? 'y' : 'ies'}`}>
                {tag}{count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Investment History ({items.length})</div>
        {items.map((item) => (
          <div key={item.active_deal_id} className={styles.contactRow}>
            <div className={styles.contactRowMain}>
              <div className={styles.contactName}>
                {item.company_id ? (
                  <a href={`/companies/${item.company_id}`} className={styles.detailLink}>{item.company_name ?? item.deal_title ?? 'Untitled deal'}</a>
                ) : (item.company_name ?? item.deal_title ?? 'Untitled deal')}
              </div>
              <div className={styles.contactMeta}>
                {item.investment_amount != null && <span>{formatINR(item.investment_amount)}</span>}
                <span className={styles.referredChip} style={{ color: DEAL_STATE_META[item.deal_state].color, background: `${DEAL_STATE_META[item.deal_state].color}1a` }}>
                  {DEAL_STATE_META[item.deal_state].label}
                </span>
              </div>
              {(item.company_sectors.length > 0 || item.company_meta_tags.length > 0) && (
                <div className={styles.sectorChipGroup} style={{ marginTop: '0.4rem' }}>
                  {[...item.company_sectors, ...item.company_meta_tags].map((t) => <span key={t} className={styles.sectorChip}>{t}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
