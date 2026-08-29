'use client'

import { useState, useTransition } from 'react'
import { submitInvestorReferral } from '@/app/actions/partner-investor-referrals'
import { describeError } from '@/lib/client-errors'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { ServiceType } from '@/lib/types'
import styles from '../portal.module.css'

/**
 * Refer an investor, from the Portal.
 *
 * This called createInvestor with isPartnerReferral: true, which that action throws on by design —
 * partners have not been able to create investor records since 20260905, because a partner entering
 * a fund we already hold makes a duplicate and a second claim on one relationship. So the button
 * has failed every time it was pressed, and the form around it asked for ticket sizes, sectors and
 * a list of contacts that nothing was ever going to store.
 *
 * It files a referral now, which is the model that replaced it: the partner tells us who they can
 * introduce, and a coordinator decides whether we already hold them.
 *
 * The fields are the ones a referral actually keeps. Asking for less is not a downgrade — the old
 * form implied a partner's ticket-size estimate would end up on the fund's record, and it would
 * not have.
 */
export default function PortalInvestorReferModal({
  onClose, onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [website, setWebsite] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    start(async () => {
      try {
        await submitInvestorReferral({
          name,
          service_type: serviceType || null,
          website,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          notes,
        })
        onSuccess()
      } catch (err) {
        setError(describeError(err).message)
      }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.referModal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.referModalTitle}>Refer an investor</div>
        <p className={styles.referIntro}>
          Tell us who you can introduce. We will check whether we already hold them and come back to
          you either way, so nobody approaches the same fund twice.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.referRow}>
            <div className={styles.referField} style={{ flex: 2 }}>
              <label className={styles.referLabel}>Investor or fund name *</label>
              <input
                className={styles.referInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Who can you introduce?"
              />
            </div>
            {/* The partner knows this and the coordinator otherwise has to guess it from twelve
                options. It also decides whether the record can ever appear on a founder-facing
                investor list, since angels are excluded from those. */}
            <div className={styles.referField}>
              <label className={styles.referLabel}>What kind of investor?</label>
              <select
                className={styles.referSelect}
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
              >
                <option value="">Not sure</option>
                {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.referRow}>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Website</label>
              <input className={styles.referInput} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Your contact there</label>
              <input className={styles.referInput} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name of the person you know" />
            </div>
          </div>

          <div className={styles.referRow}>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Their email</label>
              <input className={styles.referInput} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className={styles.referField}>
              <label className={styles.referLabel}>Their phone</label>
              <input className={styles.referInput} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div className={styles.referField}>
            <label className={styles.referLabel}>How do you know them?</label>
            <textarea
              className={styles.referInput}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What they invest in, how strong the relationship is, anything that would help us approach them well."
            />
          </div>

          {error && <div className={styles.referError}>{error}</div>}

          <div className={styles.referActions}>
            <button type="button" className={styles.referGhost} onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" className={styles.referPrimary} disabled={pending || !name.trim()}>
              {pending ? 'Sending…' : 'Send referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
