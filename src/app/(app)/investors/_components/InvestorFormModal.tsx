'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createInvestor, updateInvestor } from '@/app/actions/investors'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, ServiceType } from '@/lib/types'
import SectorTagInput from './SectorTagInput'
import Combobox from '@/app/_components/Combobox'
import styles from '../investors.module.css'

type ContactDraft = {
  key: string
  name: string
  role: string
  linkedin_url: string
  phone: string
  email: string
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Investor
  internalUsers: Array<{ id: string; name: string }>
  franchisePartners: Array<{ id: string; name: string }>
  userRole: string
  onClose: () => void
  onSaved: () => void
}

function blankContact(): ContactDraft {
  return { key: crypto.randomUUID(), name: '', role: '', linkedin_url: '', phone: '', email: '' }
}

export default function InvestorFormModal({
  mode, initial, internalUsers, franchisePartners, userRole, onClose, onSaved,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? '')
  const [serviceType, setServiceType] = useState<ServiceType>(initial?.service_type ?? 'vc_fund')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [website, setWebsite] = useState(initial?.website ?? '')
  const [stage, setStage] = useState(initial?.stage ?? '')
  const [esvPocs, setEsvPocs] = useState<string[]>(initial?.esv_pocs?.map((p) => p.id) ?? (initial?.esv_poc_id ? [initial.esv_poc_id] : []))
  const [pocSearch, setPocSearch] = useState('')
  const [pocDropdownOpen, setPocDropdownOpen] = useState(false)
  const pocInputRef = useRef<HTMLInputElement>(null)
  const [ticketMin, setTicketMin] = useState(initial?.ticket_size_min?.toString() ?? '')
  const [ticketMax, setTicketMax] = useState(initial?.ticket_size_max?.toString() ?? '')
  const [sectors, setSectors] = useState<string[]>(initial?.sectors ?? [])
  const [businessTypes, setBusinessTypes] = useState<string[]>(initial?.business_types ?? [])
  const [metaTags, setMetaTags] = useState<string[]>(initial?.meta_tags ?? [])
  const [referredBy, setReferredBy] = useState(initial?.referred_by_partner_id ?? '')
  const [onboardingDone, setOnboardingDone] = useState(initial?.onboarding_form_completed ?? false)
  const [onboardingUrl, setOnboardingUrl] = useState(initial?.onboarding_form_url ?? '')
  const [kycDone, setKycDone] = useState(initial?.kyc_done ?? false)
  const [contacts, setContacts] = useState<ContactDraft[]>(
    mode === 'create' ? [] : []  // contacts managed live in detail drawer on edit
  )

  const isPartner = userRole === 'franchise_partner'
  const canSetReferredBy = ['founder', 'admin'].includes(userRole)
  const showContacts = serviceType !== 'angel_investor'
  const showOnboardingKyc = serviceType === 'angel_investor' && !isPartner

  function setContact(key: string, field: keyof ContactDraft, val: string) {
    setContacts((cs) => cs.map((c) => c.key === key ? { ...c, [field]: val } : c))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const contactDrafts = contacts
      .filter((c) => c.name.trim())
      .map((c, i) => ({
        name: c.name.trim(),
        role: c.role.trim() || null,
        linkedin_url: c.linkedin_url.trim() || null,
        linkedin_status: null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        sort_order: i,
      }))

    startTransition(async () => {
      if (mode === 'create') {
        await createInvestor({
          name: name.trim(),
          country: country.trim() || null,
          website: website.trim() || null,
          sectors,
          business_types: businessTypes,
          meta_tags: metaTags,
          service_type: serviceType,
          esv_poc_id: isPartner ? null : (esvPocs[0] ?? null),
          esv_poc_ids: isPartner ? [] : esvPocs,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          referred_by_partner_id: isPartner ? null : (referredBy || null),
          onboarding_form_completed: showOnboardingKyc ? onboardingDone : false,
          onboarding_form_url: showOnboardingKyc ? (onboardingUrl.trim() || null) : null,
          kyc_done: showOnboardingKyc ? kycDone : false,
          contacts: contactDrafts,
          isPartnerReferral: isPartner,
        })
      } else {
        await updateInvestor(initial!.id, {
          name: name.trim(),
          country: country.trim() || null,
          website: website.trim() || null,
          sectors,
          business_types: businessTypes,
          meta_tags: metaTags,
          service_type: serviceType,
          esv_poc_id: esvPocs[0] ?? null,
          esv_poc_ids: esvPocs,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          referred_by_partner_id: referredBy || null,
          onboarding_form_completed: showOnboardingKyc ? onboardingDone : false,
          onboarding_form_url: showOnboardingKyc ? (onboardingUrl.trim() || null) : null,
          kyc_done: showOnboardingKyc ? kycDone : false,
        })
      }
      router.refresh()
      onSaved()
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalLarge} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {mode === 'create' ? 'Add Investor' : 'Edit Investor'}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row 1: Name + Service Type */}
          <div className={styles.formRow}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Name *</label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fund or individual name" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Type *</label>
              <select className={styles.select} value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
                {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Country + Website */}
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Country</label>
              <input className={styles.input} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India, UAE, US…" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Website</label>
              <input className={styles.input} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          {/* Row 3: Stage + ESV POC */}
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Stage Preference</label>
              <input className={styles.input} value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Pre-Seed, Seed, Series A…" />
            </div>
            {!isPartner && (
            <div className={styles.field}>
              <label className={styles.label}>ESV POC</label>
              <div className={styles.pocSearchWrap} onClick={() => pocInputRef.current?.focus()}>
                {esvPocs.map((id) => {
                  const user = internalUsers.find((u) => u.id === id)
                  if (!user) return null
                  return (
                    <span key={id} className={styles.pocSelectedChip}>
                      {user.name}
                      <button
                        type="button"
                        className={styles.pocSelectedChipRemove}
                        onMouseDown={(e) => { e.preventDefault(); setEsvPocs((prev) => prev.filter((x) => x !== id)) }}
                      >×</button>
                    </span>
                  )
                })}
                <input
                  ref={pocInputRef}
                  type="text"
                  className={styles.pocSearchInput}
                  placeholder={esvPocs.length === 0 ? 'Search team member…' : ''}
                  value={pocSearch}
                  onChange={(e) => { setPocSearch(e.target.value); setPocDropdownOpen(true) }}
                  onFocus={() => setPocDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setPocDropdownOpen(false), 150)}
                />
                {pocDropdownOpen && (
                  <div className={styles.pocDropdown}>
                    {internalUsers
                      .filter((u) => !esvPocs.includes(u.id) && u.name.toLowerCase().includes(pocSearch.toLowerCase()))
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={styles.pocDropdownItem}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setEsvPocs((prev) => [...prev, u.id])
                            setPocSearch('')
                            setPocDropdownOpen(false)
                          }}
                        >
                          {u.name}
                        </button>
                      ))
                    }
                    {internalUsers.filter((u) => !esvPocs.includes(u.id) && u.name.toLowerCase().includes(pocSearch.toLowerCase())).length === 0 && (
                      <div className={styles.pocDropdownEmpty}>No matches</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Row 4: Ticket Size */}
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Ticket Min (₹)</label>
              <input className={styles.input} type="number" min={0} value={ticketMin} onChange={(e) => setTicketMin(e.target.value)} placeholder="e.g. 500000" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ticket Max (₹)</label>
              <input className={styles.input} type="number" min={0} value={ticketMax} onChange={(e) => setTicketMax(e.target.value)} placeholder="e.g. 50000000" />
            </div>
          </div>

          {/* Onboarding + KYC — angel investors only */}
          {showOnboardingKyc && (
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Onboarding Form Completed</label>
                <select className={styles.select} value={onboardingDone ? 'yes' : 'no'} onChange={(e) => setOnboardingDone(e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>KYC Done</label>
                <select className={styles.select} value={kycDone ? 'yes' : 'no'} onChange={(e) => setKycDone(e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className={styles.field} style={{ flex: 2 }}>
                <label className={styles.label}>Signed Onboarding Form Link</label>
                <input className={styles.input} type="url" value={onboardingUrl} onChange={(e) => setOnboardingUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
          )}

          {/* Sectors */}
          <div className={styles.field}>
            <label className={styles.label}>Sectors</label>
            <SectorTagInput value={sectors} onChange={setSectors} placeholder="Type sector and press Enter or comma…" />
          </div>

          {/* Business Types + other thesis tags */}
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label}>Business Types</label>
              <SectorTagInput value={businessTypes} onChange={setBusinessTypes} placeholder="e.g. B2B SaaS, Marketplace, D2C…" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Other Thesis Tags</label>
              <SectorTagInput value={metaTags} onChange={setMetaTags} placeholder="e.g. Quick Commerce, AI/ML…" />
            </div>
          </div>

          {/* Referred By — admin/founder only */}
          {canSetReferredBy && (
            <div className={styles.field}>
              <label className={styles.label}>Referred by Partner</label>
              <Combobox
                options={franchisePartners.map((p) => ({ id: p.id, label: p.name }))}
                value={referredBy}
                onChange={setReferredBy}
                placeholder="Search a partner…"
              />
            </div>
          )}

          {/* Contacts — create mode only, not angel_investor */}
          {mode === 'create' && showContacts && (
            <div className={styles.contactsSection}>
              <div className={styles.contactsSectionTitle}>
                Contacts
                <button type="button" className={styles.addContactInlineBtn}
                  onClick={() => setContacts((cs) => [...cs, blankContact()])}>
                  + Add
                </button>
              </div>
              {contacts.map((c) => (
                <div key={c.key} className={styles.contactDraftRow}>
                  <input className={styles.input} placeholder="Name *" value={c.name}
                    onChange={(e) => setContact(c.key, 'name', e.target.value)} />
                  <input className={styles.input} placeholder="Role" value={c.role}
                    onChange={(e) => setContact(c.key, 'role', e.target.value)} />
                  <input className={styles.input} placeholder="Email *" type="email" value={c.email}
                    onChange={(e) => setContact(c.key, 'email', e.target.value)} />
                  <input className={styles.input} placeholder="LinkedIn URL" type="url" value={c.linkedin_url}
                    onChange={(e) => setContact(c.key, 'linkedin_url', e.target.value)} />
                  <input className={styles.input} placeholder="Phone" value={c.phone}
                    onChange={(e) => setContact(c.key, 'phone', e.target.value)} />
                  <button type="button" className={styles.contactDraftRemove}
                    onClick={() => setContacts((cs) => cs.filter((x) => x.key !== c.key))}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending || !name.trim()}>
              {isPending ? 'Saving…' : mode === 'create' ? 'Add Investor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
