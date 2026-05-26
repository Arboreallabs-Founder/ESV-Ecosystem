'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitPartnerDeal } from '@/app/actions/deals'
import type { Deal } from '@/lib/types'
import styles from './portal.module.css'

const SECTORS = ['Technology', 'Fintech', 'Healthcare', 'Real Estate', 'Consumer', 'B2B SaaS', 'Media', 'EdTech', 'Other']
const FUNDING_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Other']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PortalClient({
  partnerName,
  franchisePartnerId,
  referredDeals,
}: {
  partnerName: string
  franchisePartnerId: string | null
  referredDeals: Deal[]
}) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!franchisePartnerId) return
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await submitPartnerDeal(formData, franchisePartnerId)
        setIsModalOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission failed.')
      }
    })
  }

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Partner Portal</h1>
          <p className={styles.sub}>Welcome, {partnerName}. Submit deals and track your referrals.</p>
        </div>
        {franchisePartnerId && (
          <button className={styles.submitBtn} onClick={() => setIsModalOpen(true)}>
            + Submit Deal
          </button>
        )}
      </div>

      {!franchisePartnerId && (
        <div className={styles.setupNotice}>
          <strong>Account not fully set up.</strong>
          <br />
          Your partner account hasn&apos;t been linked yet. Contact an admin to complete your setup.
        </div>
      )}

      {franchisePartnerId && (
        <>
          <h2 className={styles.sectionTitle}>My Referrals</h2>
          <div className={styles.tableWrap}>
            {referredDeals.length === 0 ? (
              <div className={styles.empty}>No deals submitted yet. Click &ldquo;+ Submit Deal&rdquo; to get started.</div>
            ) : (
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Company</th>
                    <th>Sector</th>
                    <th>Stage</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {referredDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td><strong>{deal.company_name}</strong></td>
                      <td>{deal.sector}</td>
                      <td><span className={styles.stagePill}>{deal.current_stage}</span></td>
                      <td>{formatDate(deal.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {isModalOpen && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false) }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Submit a Deal</h2>
              <button className={styles.modalClose} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="company_name">Company Name *</label>
                <input id="company_name" name="company_name" className={styles.input} placeholder="e.g. Acme Corp" required disabled={isPending} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sector">Sector</label>
                <select id="sector" name="sector" className={styles.select} disabled={isPending} defaultValue="Technology">
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="funding_stage">Funding Stage</label>
                <select id="funding_stage" name="funding_stage" className={styles.select} disabled={isPending} defaultValue="Seed">
                  {FUNDING_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className={styles.footer}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)} disabled={isPending}>Cancel</button>
                <button type="submit" className={styles.confirmBtn} disabled={isPending}>
                  {isPending ? 'Submitting…' : 'Submit Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
