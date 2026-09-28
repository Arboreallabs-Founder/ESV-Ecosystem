'use client'

import { useState, useTransition } from 'react'
import type { GeneralFounderLink, TeamReferralLink } from '@/lib/associate-referrals'
import { setReferralSlug } from '@/app/actions/associate-referrals'
import { referralPath } from '@/lib/referral-path'
import { describeError } from '@/lib/client-errors'
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

const smallBtn: React.CSSProperties = {
  border: '1px solid var(--color-border)', background: 'var(--color-card)',
  color: 'var(--color-text)', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)',
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

/**
 * Every ESV team member's founder link in one place. Links are created the first time someone opens
 * /referrals (or by the 20261008000000 backfill); here founders/admins can see them, copy them, and
 * rename the readable /apply/<name> address (20261011000000) — e.g. to settle a clash.
 */
export default function ReferralLinksTable({ links: initial, general }: { links: TeamReferralLink[]; general: GeneralFounderLink | null }) {
  const [links, setLinks] = useState(initial)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const total = links.reduce((sum, l) => sum + l.sourcedCount, 0)

  async function copyGeneral() {
    try {
      await navigator.clipboard.writeText(`${origin}/apply`)
      setCopiedId('general')
      setTimeout(() => setCopiedId((c) => (c === 'general' ? null : c)), 1600)
    } catch { /* clipboard blocked — the link is on screen either way */ }
  }

  async function copy(l: TeamReferralLink) {
    if (!l.token) return
    try {
      await navigator.clipboard.writeText(`${origin}${referralPath(l.slug, l.token)}`)
      setCopiedId(l.userId)
      setTimeout(() => setCopiedId((c) => (c === l.userId ? null : c)), 1600)
    } catch { /* clipboard blocked */ }
  }

  function startEdit(l: TeamReferralLink) {
    setEditingId(l.userId)
    setDraft(l.slug ?? '')
    setEditError(null)
  }

  function save(userId: string) {
    setEditError(null)
    startTransition(async () => {
      try {
        const res = await setReferralSlug(userId, draft)
        setLinks((prev) => prev.map((l) => (l.userId === userId ? { ...l, slug: res.slug } : l)))
        setEditingId(null)
      } catch (err) { setEditError(describeError(err).message) }
    })
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

      {/* The general link (20261013000000): for the website and the company LinkedIn page. Credited to
          nobody, so it sits apart from the team roster rather than as a row in it. */}
      {general && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          padding: '0.85rem 1.1rem', marginBottom: '1rem',
          border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-card)',
        }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>General link</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
              For the ESV website and company LinkedIn page. Same form, credited to nobody ·
              {' '}{general.sourcedCount} {general.sourcedCount === 1 ? 'founder' : 'founders'} so far
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <code suppressHydrationWarning style={{
              fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)',
            }}>
              {origin}/apply
            </code>
            <button style={smallBtn} onClick={copyGeneral}>{copiedId === 'general' ? 'Copied' : 'Copy'}</button>
            <a href="/apply" target="_blank" rel="noreferrer" style={{ ...smallBtn, textDecoration: 'none' }}>Open</a>
          </div>
        </div>
      )}

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
                  <td><div className={styles.name}>{l.name || l.email}</div></td>
                  <td>
                    <span className={`${styles.roleBadge} ${ROLE_CLASS[l.role] ?? styles.roleAssociate}`}>
                      {ROLE_LABELS[l.role] ?? l.role}
                    </span>
                  </td>
                  <td>
                    {!l.token ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>Not created yet</span>
                    ) : editingId === l.userId ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>/apply/</span>
                          <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') save(l.userId); if (e.key === 'Escape') setEditingId(null) }}
                            autoFocus
                            maxLength={40}
                            style={{
                              fontSize: '0.8125rem', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)',
                              border: '1.5px solid var(--color-border)', background: 'var(--color-bg)',
                              color: 'var(--color-text)', fontFamily: 'inherit', width: '9rem',
                            }}
                          />
                          <button style={smallBtn} onClick={() => save(l.userId)} disabled={pending || !draft.trim()}>
                            {pending ? 'Saving…' : 'Save'}
                          </button>
                          <button style={smallBtn} onClick={() => setEditingId(null)} disabled={pending}>Cancel</button>
                        </div>
                        {editError && <span style={{ fontSize: '0.75rem', color: 'var(--color-destructive)' }}>{editError}</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <code style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                          {l.slug ? `/apply/${l.slug}` : `/f/${l.token.slice(0, 8)}…`}
                        </code>
                        <button style={smallBtn} onClick={() => copy(l)}>
                          {copiedId === l.userId ? 'Copied' : 'Copy'}
                        </button>
                        <button style={smallBtn} onClick={() => startEdit(l)}>Rename</button>
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.sourcedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
