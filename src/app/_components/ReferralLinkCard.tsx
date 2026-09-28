'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { getOrCreateMyAssociateReferralLink } from '@/app/actions/associate-referrals'
import { alertError } from '@/lib/client-errors'
import styles from './referral-link-card.module.css'

/**
 * Any ESV team member's own referral link — post it on LinkedIn, send it directly, whatever.
 * Whoever fills it in submits themselves; it lands on the ESV Referrals pipeline credited to
 * whoever shared the link (see supabase/migrations/20261007000000, 20261008000000).
 */
export default function ReferralLinkCard({ initialToken, pipelineId, sourcedCount }: {
  initialToken: string | null
  pipelineId: string | null
  sourcedCount: number
}) {
  const [token, setToken] = useState(initialToken)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the link is on screen either way */ }
  }

  return (
    <div className={styles.card}>
      <div className={styles.body}>
        <div className={styles.title}>Your referral link</div>
        <div className={styles.sub}>
          Share it on LinkedIn or send it directly — whoever fills it in submits themselves, and it
          lands here credited to you.
          {sourcedCount > 0 && pipelineId && (
            <> <Link href={`/pipelines/${pipelineId}`} className={styles.subLink}>
              {sourcedCount} sourced so far →
            </Link></>
          )}
        </div>
      </div>
      {token ? (
        <div className={styles.linkRow}>
          <code className={styles.linkBox}>{`${origin}/f/${token}`}</code>
          <button className={styles.btn} onClick={() => copy(`${origin}/f/${token}`)}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <button
          className={styles.btnPrimary}
          disabled={pending}
          onClick={() => startTransition(async () => {
            try { setToken((await getOrCreateMyAssociateReferralLink()).token) }
            catch (err) { alertError(err) }
          })}
        >
          {pending ? 'Creating…' : 'Get my link'}
        </button>
      )}
    </div>
  )
}
