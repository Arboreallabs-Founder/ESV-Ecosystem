'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError, describeError } from '@/lib/client-errors'
import { submitInvestorReferral } from '@/app/actions/partner-investor-referrals'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { PartnerInvestorReferral, ServiceType } from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../investors.module.css'

/**
 * A partner's side of investor referrals.
 *
 * Partners cannot create investors: adding a fund we already hold makes a duplicate record and a
 * second claim on one relationship. So this is a referral, not a record — it goes to an SGP
 * Coordinator, who either tags the fund we already have to this partner or creates it. Either way
 * the partner ends up credited without the database growing a twin.
 */
export default function ReferInvestorPanel({ referrals }: { referrals: PartnerInvestorReferral[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setError(null)
    setSaved(null)
    start(async () => {
      try {
        const name = String(fd.get('name') ?? '')
        await submitInvestorReferral({
          name,
          service_type: (String(fd.get('service_type') ?? '') || null) as ServiceType | null,
          contact_name: String(fd.get('contact_name') ?? ''),
          contact_email: String(fd.get('contact_email') ?? ''),
          contact_phone: String(fd.get('contact_phone') ?? ''),
          website: String(fd.get('website') ?? ''),
          notes: String(fd.get('notes') ?? ''),
        })
        form.reset()
        setOpen(false)
        setSaved(name)
        router.refresh()
      } catch (err) {
        setError(describeError(err).message)
        alertError(err)
      }
    })
  }

  const pendingOnes = referrals.filter((r) => r.status === 'pending')
  const decided = referrals.filter((r) => r.status !== 'pending')

  return (
    <div className={styles.referBlock}>
      <div className={styles.referHead}>
        <div>
          <div className={styles.referTitle}>Refer an investor</div>
          <p className={styles.referSub}>
            Tell us who you can introduce and we&apos;ll check it against the funds we already hold.
            If we have them, we tag them to you — no duplicate record, no second claim on the same
            relationship. If we don&apos;t, we add them credited to you.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => { setOpen((v) => !v); setError(null) }}>
          {open ? 'Cancel' : '+ Refer an investor'}
        </button>
      </div>

      {saved && (
        <div className={styles.referSuccess}>
          <strong>{saved}</strong> sent to the SGP Coordinator. You&apos;ll see the outcome here.
        </div>
      )}

      {open && (
        <form className={styles.referForm} onSubmit={handleSubmit}>
          {/* Only the name is required. The point is to capture the introduction while it is in
              front of you; a form that demands a website loses the referral. */}
          <div className={styles.referGrid}>
            <label className={`${styles.referField} ${styles.referFieldWide}`}>
              <span className={styles.referLabel}>Investor or fund name *</span>
              <input className={styles.referInput} name="name" required autoFocus placeholder="Who can you introduce?" />
            </label>
            {/* The partner knows what this is, and without it a coordinator picks from twelve
                options on their behalf. It also decides whether the record can ever reach a
                founder-facing investor list, since angels are excluded from those. */}
            <label className={styles.referField}>
              <span className={styles.referLabel}>What kind of investor?</span>
              <select className={styles.referInput} name="service_type" defaultValue="">
                <option value="">Not sure</option>
                {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.referField}>
              <span className={styles.referLabel}>Website</span>
              <input className={styles.referInput} name="website" placeholder="https://…" />
            </label>
            <label className={styles.referField}>
              <span className={styles.referLabel}>Your contact there</span>
              <input className={styles.referInput} name="contact_name" placeholder="Name of the person you know" />
            </label>
            <label className={styles.referField}>
              <span className={styles.referLabel}>Their email</span>
              <input className={styles.referInput} type="email" name="contact_email" />
            </label>
            <label className={styles.referField}>
              <span className={styles.referLabel}>Their phone</span>
              <input className={styles.referInput} name="contact_phone" />
            </label>
            <label className={`${styles.referField} ${styles.referFieldWide}`}>
              <span className={styles.referLabel}>How do you know them?</span>
              <textarea
                className={styles.referTextarea}
                name="notes"
                rows={3}
                placeholder="What they invest in, how strong the relationship is, anything that would help us approach them well."
              />
            </label>
          </div>

          {error && <div className={styles.referError}>{error}</div>}

          <div className={styles.referActions}>
            <button type="submit" className={styles.addBtn} disabled={pending}>
              {pending ? 'Sending…' : 'Send referral'}
            </button>
          </div>
        </form>
      )}

      {pendingOnes.length > 0 && (
        <div className={styles.referList}>
          <div className={styles.referListTitle}>Waiting on us</div>
          {pendingOnes.map((r) => (
            <div key={r.id} className={styles.referRow}>
              <span className={styles.referRowName}>{r.name}</span>
              <span className={styles.referRowMeta}>referred {formatDateTimeIst(r.created_at)}</span>
              <span className={styles.referPending}>Pending</span>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className={styles.referList}>
          <div className={styles.referListTitle}>Decided</div>
          {decided.map((r) => (
            <div key={r.id} className={styles.referRow}>
              <span className={styles.referRowName}>{r.investor?.name ?? r.name}</span>
              {/* A rejection always carries its reason. "No" on its own is what stops people
                  referring at all. */}
              <span className={styles.referRowMeta}>
                {r.status === 'accepted' ? 'Credited to you' : r.decision_note || 'Not taken forward'}
              </span>
              <span className={r.status === 'accepted' ? styles.referAccepted : styles.referRejected}>
                {r.status === 'accepted' ? 'Accepted' : 'Not taken forward'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
