'use client'

import type { EmployeeProfile } from '@/lib/types'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/types'
import styles from './id-card.module.css'

/**
 * Digital employee ID card.
 *
 * The photo comes from `profile.id_photo_url` and **never falls back to `users.photo_url`**.
 * That column holds whatever was mirrored in from a pasted link — usually a LinkedIn headshot,
 * cropped for a 24px chip and often years old. An ID card is identification: showing a photo the
 * person didn't supply for that purpose would make the card quietly untrustworthy. With no ID
 * photo the card says so instead.
 */
export default function IdCard({
  name, designation, profile, orgName = 'Earlyseed Ventures',
}: {
  name: string
  designation: string | null
  profile: EmployeeProfile | null
  orgName?: string
}) {
  const hasPhoto = !!profile?.id_photo_url

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/esv-wordmark-black.jpg" alt={orgName} className={styles.wordmark} />
        <span className={styles.kind}>Employee ID</span>
      </div>

      <div className={styles.body}>
        <div className={styles.photoWrap}>
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile!.id_photo_url!} alt="" className={styles.photo} />
          ) : (
            <div className={styles.photoEmpty}>
              <span className={styles.photoEmptyIcon}>📷</span>
              <span>No ID photo</span>
            </div>
          )}
        </div>

        <div className={styles.details}>
          <div className={styles.name}>{profile?.legal_name || name}</div>
          <div className={styles.designation}>{designation || 'Team Member'}</div>

          <dl className={styles.facts}>
            {profile?.employee_code && (
              <div className={styles.fact}>
                <dt>ID</dt><dd className={styles.mono}>{profile.employee_code}</dd>
              </div>
            )}
            {profile?.employment_type && (
              <div className={styles.fact}>
                <dt>Type</dt><dd>{EMPLOYMENT_TYPE_LABELS[profile.employment_type]}</dd>
              </div>
            )}
            {profile?.date_of_joining && (
              <div className={styles.fact}>
                <dt>Since</dt><dd>{profile.date_of_joining}</dd>
              </div>
            )}
            {/* Blood group is on the card for the reason it is on any ID card — it is the one
                detail that matters to a stranger in an emergency. */}
            {profile?.blood_group && (
              <div className={styles.fact}>
                <dt>Blood</dt><dd className={styles.blood}>{profile.blood_group}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {(profile?.emergency_contact_name || profile?.emergency_contact_phone) && (
        <div className={styles.emergency}>
          <span className={styles.emergencyLabel}>In emergency</span>
          <span className={styles.emergencyValue}>
            {profile.emergency_contact_name}
            {profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ''}
          </span>
        </div>
      )}

      <div className={styles.foot}>
        {orgName} · This card remains the property of the company and must be returned on exit.
      </div>
    </div>
  )
}
