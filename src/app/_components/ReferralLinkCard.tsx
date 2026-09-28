'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { getOrCreateMyAssociateReferralLink, setReferralSlug } from '@/app/actions/associate-referrals'
import { alertError, describeError } from '@/lib/client-errors'
import { referralPath } from '@/lib/referral-path'
import styles from './referral-link-card.module.css'

/**
 * Any ESV team member's own founder link — post it on LinkedIn, send it directly. A founder fills
 * it in about their own startup; it lands on the ESV Referrals pipeline credited to whoever shared
 * the link (see supabase/migrations/20261007000000 → 20261011000000). Shown as the readable
 * /apply/<name> address, which the owner can rename.
 */
export default function ReferralLinkCard({ userId, initialToken, initialSlug, pipelineId, sourcedCount }: {
  userId: string
  initialToken: string | null
  initialSlug: string | null
  pipelineId: string | null
  sourcedCount: number
}) {
  const [token, setToken] = useState(initialToken)
  const [slug, setSlug] = useState(initialSlug)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = token ? `${origin}${referralPath(slug, token)}` : ''

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the link is on screen either way */ }
  }

  function saveSlug() {
    setEditError(null)
    startTransition(async () => {
      try {
        const res = await setReferralSlug(userId, draft)
        setSlug(res.slug)
        setEditing(false)
      } catch (err) { setEditError(describeError(err).message) }
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.body}>
        <div className={styles.title}>Your founder link</div>
        <div className={styles.sub}>
          Post it on LinkedIn or send it to a founder — they tell us about their startup themselves,
          and it comes back credited to you.
          {sourcedCount > 0 && pipelineId && (
            <> <Link href={`/pipelines/${pipelineId}`} className={styles.subLink}>
              {sourcedCount} {sourcedCount === 1 ? 'founder' : 'founders'} so far →
            </Link></>
          )}
        </div>
      </div>
      {!token ? (
        <button
          className={styles.btnPrimary}
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              const res = await getOrCreateMyAssociateReferralLink()
              setToken(res.token)
              setSlug(res.slug)
            } catch (err) { alertError(err) }
          })}
        >
          {pending ? 'Creating…' : 'Get my link'}
        </button>
      ) : editing ? (
        <div className={styles.editWrap}>
          <div className={styles.linkRow}>
            <span className={styles.prefix}>{origin}/apply/</span>
            <input
              className={styles.slugInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveSlug(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
              maxLength={40}
            />
            <button className={styles.btnPrimary} onClick={saveSlug} disabled={pending || !draft.trim()}>
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button className={styles.btn} onClick={() => setEditing(false)} disabled={pending}>Cancel</button>
          </div>
          {editError && <div className={styles.error}>{editError}</div>}
          {slug && <div className={styles.hint}>Your old /apply/{slug} address will stop working.</div>}
        </div>
      ) : (
        <div className={styles.linkRow}>
          <code className={styles.linkBox}>{url}</code>
          <button className={styles.btn} onClick={() => copy(url)}>{copied ? 'Copied' : 'Copy'}</button>
          <button className={styles.btn} onClick={() => { setDraft(slug ?? ''); setEditError(null); setEditing(true) }}>
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
