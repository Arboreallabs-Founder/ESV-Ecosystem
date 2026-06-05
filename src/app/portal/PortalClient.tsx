'use client'

import styles from './portal.module.css'

export default function PortalClient({
  partnerName,
  franchisePartnerId,
}: {
  partnerName: string
  franchisePartnerId: string | null
}) {
  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Partner Portal</h1>
          <p className={styles.sub}>Welcome, {partnerName}.</p>
        </div>
      </div>

      {!franchisePartnerId ? (
        <div className={styles.setupNotice}>
          <strong>Account not fully set up.</strong>
          <br />
          Your partner account hasn&apos;t been linked yet. Contact an admin to complete your setup.
        </div>
      ) : (
        <div className={styles.setupNotice} style={{ borderColor: 'var(--color-primary)', background: 'rgba(116,95,253,0.06)', color: 'var(--color-text)' }}>
          <strong>Submit deals via your form link.</strong>
          <br />
          Your admin will share a form link with you. Use it to submit deals directly into the pipeline.
        </div>
      )}
    </>
  )
}
