'use client'

import type { EmployeeProfile } from '@/lib/types'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/types'
import styles from './id-card.module.css'

/**
 * Digital employee ID card.
 *
 * Two deliberate constraints:
 *
 * 1. The photo comes from `profile.id_photo_url` and **never falls back to `users.photo_url`**.
 *    That column holds whatever was mirrored in from a pasted link — usually a LinkedIn headshot,
 *    cropped for a 24px chip and often years old. An ID card is identification; showing a photo
 *    the person didn't supply for that purpose would make the card quietly untrustworthy. With no
 *    ID photo the card shows an empty frame instead.
 *
 * 2. It renders in light colours in every theme, using literal hex rather than the app's CSS
 *    variables. A card is a document — it should look the same on a colleague's dark-mode phone,
 *    on an OLED screen and on paper. Theme-reactive tokens would give three different documents.
 */
export default function IdCard({
  name, designation, profile, printable = false, orgName = 'Earlyseed Ventures',
}: {
  name: string
  designation: string | null
  profile: EmployeeProfile | null
  /** Adds a Print button; the button itself is hidden from the printed output. */
  printable?: boolean
  orgName?: string
}) {
  const rows: Array<[string, React.ReactNode]> = []
  if (profile?.employee_code) rows.push(['ID', profile.employee_code])
  if (profile?.employment_type) rows.push(['Type', EMPLOYMENT_TYPE_LABELS[profile.employment_type]])
  if (profile?.date_of_joining) rows.push(['Since', profile.date_of_joining])
  if (profile?.blood_group) rows.push(['Blood', profile.blood_group])

  return (
    <div className={styles.printRoot}>
      <div className={styles.card}>
        {/* ── Header ── */}
        <div className={styles.head}>
          <ArcPattern className={styles.headArcs} />
          <div className={styles.brandBlock}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/esv-wordmark-black.jpg" alt={orgName} className={styles.wordmark} />
          </div>
          <div className={styles.headRight}>
            <span className={styles.kind}>Employee ID</span>
            <DotGrid className={styles.headDots} />
          </div>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          <div className={styles.photoWrap}>
            {profile?.id_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.id_photo_url} alt="" className={styles.photo} />
            ) : (
              <div className={styles.photoEmpty}>
                <WavePattern className={styles.photoWave} />
                <span className={styles.photoEmptyText}>No ID photo</span>
              </div>
            )}
          </div>

          <div className={styles.details}>
            {/* Not in the mockup, kept deliberately: a card that cannot identify its holder is
                not an identity document. */}
            <div className={styles.nameBlock}>
              <div className={styles.name}>{profile?.legal_name || name}</div>
              <div className={styles.designation}>{designation || 'Team Member'}</div>
            </div>

            <dl className={styles.rows}>
              {rows.map(([label, value]) => (
                <div key={label} className={styles.row}>
                  <dt className={styles.rowLabel}>{label}</dt>
                  <dd className={`${styles.rowValue} ${label === 'Blood' ? styles.blood : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ── Emergency ── */}
        <div className={styles.emergency}>
          <div className={styles.emergencyIcon}><ShieldIcon /></div>
          <div className={styles.emergencyText}>
            <span className={styles.emergencyTitle}>In Emergency</span>
            <span className={styles.emergencySub}>
              {profile?.emergency_contact_name || 'Contact the below person'}
            </span>
          </div>
          <div className={styles.emergencyDivider} />
          <div className={styles.emergencyPhone}>
            <span className={styles.phoneIcon}><PhoneIcon /></span>
            <span className={styles.phoneNumber}>
              {profile?.emergency_contact_phone || <span className={styles.phoneBlank} />}
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.foot}>
          <span className={styles.footIcon}><LockIcon /></span>
          <span className={styles.footDivider} />
          <span className={styles.footText}>
            {orgName} · This card remains the property of the company and must be returned on exit.
          </span>
          <DotGrid className={styles.footDots} />
        </div>
      </div>

      {printable && (
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>
          Print card
        </button>
      )}
    </div>
  )
}

/* ── Decorative marks. Bronze on crema, purely ornamental, hidden from assistive tech. ── */

function ArcPattern({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M -10 ${18 + i * 9} A ${70 + i * 9} ${70 + i * 9} 0 0 1 ${18 + i * 9} -10`}
          stroke="#D5AE8F" strokeWidth="0.9" opacity={0.5 - i * 0.05}
        />
      ))}
    </svg>
  )
}

function DotGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 30" fill="none" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 8 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={3 + c * 8} cy={3 + r * 8} r="1.3" fill="#D5AE8F" opacity="0.55" />
        )),
      )}
    </svg>
  )
}

function WavePattern({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 70" fill="none" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M 0 ${28 + i * 6} C 25 ${16 + i * 6}, 45 ${44 + i * 6}, 100 ${24 + i * 6}`}
          stroke="#D5AE8F" strokeWidth="0.8" opacity={0.42 - i * 0.03}
        />
      ))}
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#745FFD" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7.5 3v5.25c0 4.5-3 8.2-7.5 9.75-4.5-1.55-7.5-5.25-7.5-9.75V6L12 3Z" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#745FFD" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.6 3.5h2.7l1.4 3.4-1.7 1.2a11 11 0 0 0 5.4 5.4l1.2-1.7 3.4 1.4v2.7a1.9 1.9 0 0 1-2.1 1.9A15.6 15.6 0 0 1 4.7 5.6a1.9 1.9 0 0 1 1.9-2.1Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#B08968" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 1 1 7 0v2.7" />
    </svg>
  )
}
