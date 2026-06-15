'use client'

import { useState, useTransition } from 'react'
import { createInvestor } from '@/app/actions/investors'
import { SERVICE_TYPE_LABELS, LINKEDIN_STATUS_OPTIONS } from '@/lib/types'
import type { ServiceType } from '@/lib/types'
import SectorTagInput from '../../investors/_components/SectorTagInput'
import styles from '../portal.module.css'

type ContactDraft = {
  key: string
  name: string
  role: string
  linkedin_url: string
  linkedin_status: string
  phone: string
  email: string
}

function blankContact(): ContactDraft {
  return { key: crypto.randomUUID(), name: '', role: '', linkedin_url: '', linkedin_status: '', phone: '', email: '' }
}

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function PortalInvestorReferModal({ onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('vc_fund')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [stage, setStage] = useState('')
  const [ticketMin, setTicketMin] = useState('')
  const [ticketMax, setTicketMax] = useState('')
  const [sectors, setSectors] = useState<string[]>([])
  const [contacts, setContacts] = useState<ContactDraft[]>([])

  const showContacts = serviceType !== 'angel_investor'

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
        linkedin_status: c.linkedin_status || null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        sort_order: i,
      }))

    startTransition(async () => {
      await createInvestor({
        name: name.trim(),
        country: country.trim() || null,
        website: website.trim() || null,
        sectors,
        service_type: serviceType,
        esv_poc_id: null,
        ticket_size_min: ticketMin ? Number(ticketMin) : null,
        ticket_size_max: ticketMax ? Number(ticketMax) : null,
        stage: stage.trim() || null,
        referred_by_partner_id: null,
        contacts: contactDrafts,
        isPartnerReferral: true,
      })
      onSuccess()
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.referModal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.referModalTitle}>Refer an Investor</div>

        <form onSubmit={handleSubmit}>
          <div className={styles.referRow}>
            <div className={styles.referField} style={{ flex: 2 }}>
              <label className={styles.referLabel}>Name *</label>
              <input className={styles.referInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fund or person name" />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Type *</label>
              <select className={styles.referSelect} value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
                {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.referRow}>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Country</label>
              <input className={styles.referInput} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India, UAE…" />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Website</label>
              <input className={styles.referInput} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className={styles.referRow}>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Stage Preference</label>
              <input className={styles.referInput} value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Seed, Series A…" />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Ticket Min (₹)</label>
              <input className={styles.referInput} type="number" min={0} value={ticketMin} onChange={(e) => setTicketMin(e.target.value)} />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Ticket Max (₹)</label>
              <input className={styles.referInput} type="number" min={0} value={ticketMax} onChange={(e) => setTicketMax(e.target.value)} />
            </div>
          </div>

          <div className={styles.referField}>
            <label className={styles.referLabel}>Sectors</label>
            <SectorTagInput value={sectors} onChange={setSectors} placeholder="Type a sector and press Enter or comma…" />
          </div>

          {showContacts && (
            <div className={styles.referContactsSection}>
              <div className={styles.referContactsTitle}>
                Key Contacts
                <button type="button" className={styles.referAddContactBtn}
                  onClick={() => setContacts((cs) => [...cs, blankContact()])}>
                  + Add
                </button>
              </div>
              {contacts.map((c) => (
                <div key={c.key} className={styles.referContactRow}>
                  <input className={styles.referInput} placeholder="Name *" value={c.name}
                    onChange={(e) => setContact(c.key, 'name', e.target.value)} />
                  <input className={styles.referInput} placeholder="Role" value={c.role}
                    onChange={(e) => setContact(c.key, 'role', e.target.value)} />
                  <select className={styles.referSelect} value={c.linkedin_status}
                    onChange={(e) => setContact(c.key, 'linkedin_status', e.target.value)}>
                    <option value="">LinkedIn</option>
                    {LINKEDIN_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input className={styles.referInput} placeholder="Email" type="email" value={c.email}
                    onChange={(e) => setContact(c.key, 'email', e.target.value)} />
                  <button type="button" className={styles.referRemoveBtn}
                    onClick={() => setContacts((cs) => cs.filter((x) => x.key !== c.key))}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.referModalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.generateBtn} disabled={isPending || !name.trim()}>
              {isPending ? 'Submitting…' : 'Submit Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
