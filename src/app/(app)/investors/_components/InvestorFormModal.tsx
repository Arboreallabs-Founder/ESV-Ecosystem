'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvestor, updateInvestor } from '@/app/actions/investors'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, ServiceType } from '@/lib/types'
import SectorTagInput from './SectorTagInput'
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
  const [esvPoc, setEsvPoc] = useState(initial?.esv_poc_id ?? '')
  const [ticketMin, setTicketMin] = useState(initial?.ticket_size_min?.toString() ?? '')
  const [ticketMax, setTicketMax] = useState(initial?.ticket_size_max?.toString() ?? '')
  const [sectors, setSectors] = useState<string[]>(initial?.sectors ?? [])
  const [referredBy, setReferredBy] = useState(initial?.referred_by_partner_id ?? '')
  const [contacts, setContacts] = useState<ContactDraft[]>(
    mode === 'create' ? [] : []  // contacts managed live in detail drawer on edit
  )

  const canSetReferredBy = ['founder', 'admin'].includes(userRole)
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
          service_type: serviceType,
          esv_poc_id: esvPoc || null,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          referred_by_partner_id: referredBy || null,
          contacts: contactDrafts,
        })
      } else {
        await updateInvestor(initial!.id, {
          name: name.trim(),
          country: country.trim() || null,
          website: website.trim() || null,
          sectors,
          service_type: serviceType,
          esv_poc_id: esvPoc || null,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          referred_by_partner_id: referredBy || null,
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
            <div className={styles.field}>
              <label className={styles.label}>ESV POC</label>
              <select className={styles.select} value={esvPoc} onChange={(e) => setEsvPoc(e.target.value)}>
                <option value="">—</option>
                {internalUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
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

          {/* Sectors */}
          <div className={styles.field}>
            <label className={styles.label}>Sectors</label>
            <SectorTagInput value={sectors} onChange={setSectors} placeholder="Type sector and press Enter or comma…" />
          </div>

          {/* Referred By — admin/founder only */}
          {canSetReferredBy && (
            <div className={styles.field}>
              <label className={styles.label}>Referred by Partner</label>
              <select className={styles.select} value={referredBy} onChange={(e) => setReferredBy(e.target.value)}>
                <option value="">—</option>
                {franchisePartners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
