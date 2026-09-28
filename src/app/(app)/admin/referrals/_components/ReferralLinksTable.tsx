'use client'

import { useState } from 'react'
import type { TeamReferralLink } from '@/lib/associate-referrals'
import Avatar from '@/app/_components/Avatar'
import styles from '../../admin.module.css'

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', general: 'General', hr: 'HR',
}
const ROLE_CLASS: Record<string, string> = {
  founder: styles.roleFounder,
  admin: styles.roleAdmin,
  associate: styles.roleAssociate,
  general: styles.roleGeneral,
  hr: styles.roleHr,
}

/**
 * Every ESV team member's referral link in one place. Read-only — a link is created the first
 * time someone opens /referrals (or by the 20261008000000 backfill for everyone already here),
 * never from this page. This is for seeing who has one and how it's doing, not managing them.
 */
export default function ReferralLinksTable({ links }: { links: TeamReferralLink[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const total = links.reduce((sum, l) => sum + l.sourcedCount, 0)

  async function copy(userId: string, token: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/f/${token}`)
      setCopiedId(userId)
      setTimeout(() => setCopiedId((c) => (c === userId ? null : c)), 1600)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Referral Links</div>
          <div className={styles.pageSub}>
            {links.filter((l) => l.token).length} of {links.length} team members have a link ·
            {' '}{total} {total === 1 ? 'founder' : 'founders'} came in through them
          </div>
        </div>
      </div>

      {links.length === 0 ? (
        <div className={styles.empty}>No team members found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '52px' }} aria-label="Photo" />
                <th>Name</th>
                <th>Role</th>
                <th>Link</th>
                <th style={{ textAlign: 'right' }}>Founders</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.userId}>
                  <td><Avatar name={l.name} email={l.email} photoUrl={l.photoUrl} size="sm" /></td>
                  <td>
                    <div className={styles.name}>{l.name || l.email}</div>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${ROLE_CLASS[l.role] ?? styles.roleAssociate}`}>
                      {ROLE_LABELS[l.role] ?? l.role}
                    </span>
                  </td>
                  <td>
                    {l.token ? (
                      <button
                        onClick={() => copy(l.userId, l.token!)}
                        style={{
                          border: '1px solid var(--color-border)', background: 'var(--color-card)',
                          color: 'var(--color-text)', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {copiedId === l.userId ? 'Copied' : 'Copy link'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>Not created yet</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {l.sourcedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
