'use client'

import { useEffect } from 'react'
import Avatar from './Avatar'
import styles from './person-card.module.css'

export type PersonDetail = {
  user_id: string
  name: string | null
  photo_url?: string | null
  designation?: string | null
  email?: string | null
  phone?: string | null
}

/**
 * Who someone is and how to reach them.
 *
 * A name on a card answers "who owns this" and nothing else — the next question is always "how do
 * I contact them", and until now that meant asking someone. Email and phone are mailto:/tel: links
 * so the answer is one tap on a phone, which is where a partner usually reads this.
 */
export default function PersonCard({ person, onClose }: { person: PersonDetail; onClose: () => void }) {
  // Escape closes it. A dialog that can only be dismissed by hitting a small ✕ is a dialog people
  // end up reloading the page to get out of.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const name = person.name ?? 'Unknown'

  return (
    // onMouseDown, not onClick: a click that starts inside the card and ends on the backdrop
    // should not close it. Selecting an email address does exactly that.
    <div className={styles.backdrop} onMouseDown={onClose} role="presentation">
      <div
        className={styles.card}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={name}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.head}>
          <Avatar name={name} photoUrl={person.photo_url ?? null} size="lg" />
          <div className={styles.headText}>
            <div className={styles.name}>{name}</div>
            {person.designation && <div className={styles.designation}>{person.designation}</div>}
          </div>
        </div>

        <div className={styles.rows}>
          {person.email ? (
            <a className={styles.row} href={`mailto:${person.email}`}>
              <span className={styles.rowLabel}>Email</span>
              <span className={styles.rowValue}>{person.email}</span>
            </a>
          ) : (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Email</span>
              <span className={styles.rowEmpty}>Not on file</span>
            </div>
          )}

          {person.phone ? (
            <a className={styles.row} href={`tel:${person.phone.replace(/\s+/g, '')}`}>
              <span className={styles.rowLabel}>Phone</span>
              <span className={styles.rowValue}>{person.phone}</span>
            </a>
          ) : (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Phone</span>
              <span className={styles.rowEmpty}>Not on file</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
