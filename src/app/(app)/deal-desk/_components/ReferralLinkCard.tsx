'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { getOrCreateMyAssociateReferralLink } from '@/app/actions/associate-referrals'
import { alertError } from '@/lib/client-errors'
import styles from './deal-desk.module.css'

/**
 * The shareable half of associate sourcing — the sibling of "+ Log a deal" (which is for typing in
 * a company yourself). Send this link to a founder and they submit themselves; it lands on the
 * Associate Sourced pipeline, credited to whoever shared it, same as the partner referral link.
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
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        padding: '0.85rem 1.1rem', marginBottom: '1rem',
        border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        background: 'var(--color-card)',
      }}
    >
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Your referral link</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
          Send this to a founder — they submit themselves and it lands here credited to you.
          {sourcedCount > 0 && pipelineId && (
            <> <Link href={`/pipelines/${pipelineId}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              {sourcedCount} sourced so far →
            </Link></>
          )}
        </div>
      </div>
      {token ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <code
            style={{
              fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)',
            }}
          >
            {`${origin}/f/${token}`}
          </code>
          <button className={styles.ghostBtn} onClick={() => copy(`${origin}/f/${token}`)}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <button
          className={styles.primaryBtn}
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
