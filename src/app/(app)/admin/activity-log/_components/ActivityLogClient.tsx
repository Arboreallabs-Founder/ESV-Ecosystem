'use client'

import { useState } from 'react'
import { alertError } from '@/lib/client-errors'
import type { ActivityLogEntry } from '@/lib/types'
import type { AppErrorEntry } from '@/lib/app-errors'
import styles from '../../admin.module.css'

const ENTITY_LABELS: Record<ActivityLogEntry['entity_type'], string> = {
  investor: 'Investor',
  hr_policy: 'HR Policy',
  event: 'Event',
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function buildLine(e: ActivityLogEntry): string {
  const who = e.edited_by_name ?? 'Unknown'
  const label = ENTITY_LABELS[e.entity_type]
  return `[${formatTimestamp(e.created_at)}] ${who} — ${label}: ${e.entity_name}: ${e.changes}`
}

/** One error as a single copyable line: everything needed to start troubleshooting. */
function errorLine(e: AppErrorEntry): string {
  const who = `${e.user_name ?? 'Unknown'}${e.user_role ? ` (${e.user_role})` : ''}`
  const parts = [
    `[${formatTimestamp(e.created_at)}] ${who}`,
    `could not ${e.step}`,
    e.code ? `code ${e.code}` : null,
    e.message,
    e.details ? `details: ${e.details}` : null,
    e.hint ? `hint: ${e.hint}` : null,
    e.page ? `page: ${e.page}` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

export default function ActivityLogClient({ entries, errors = [], showErrors = false }: {
  entries: ActivityLogEntry[]
  /** Recorded database failures, admins only (20261106000000). */
  errors?: AppErrorEntry[]
  showErrors?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'edits' | 'errors'>('edits')

  const fullText = tab === 'errors' ? errors.map(errorLine).join('\n') : entries.map(buildLine).join('\n')
  const rows = tab === 'errors' ? errors.length : entries.length

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) { alertError(err) }
  }

  function handleDownload() {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab === 'errors' ? 'error-log' : 'activity-log'}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Activity Log</div>
          <div className={styles.pageSub}>
            {tab === 'errors'
              ? 'Database failures people hit, with the code and the database message. Codes are shown on screen to admins only.'
              : 'Timestamped record of investor, HR policy, and event edits.'}
          </div>
          {showErrors && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
              {(['edits', 'errors'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.85rem',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: tab === t ? 'var(--color-primary)' : 'var(--color-card)',
                    color: tab === t ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {t === 'edits' ? `Edits (${entries.length})` : `Errors (${errors.length})`}
                </button>
              ))}
            </div>
          )}
        </div>
        {rows > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.addBtn} onClick={handleCopy}>{copied ? 'Copied!' : 'Copy all'}</button>
            <button className={styles.addBtn} onClick={handleDownload}>Download .txt</button>
          </div>
        )}
      </div>

      {rows === 0 ? (
        <div className={styles.empty}>{tab === 'errors' ? 'No errors recorded.' : 'No edits recorded yet.'}</div>
      ) : tab === 'errors' ? (
        <div style={{
          background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1.25rem', fontSize: '0.8125rem', maxHeight: '70vh', overflowY: 'auto',
        }}>
          {errors.map((e) => (
            <div key={e.id} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                {e.code && (
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, color: 'var(--color-destructive)' }}>
                    {e.code}
                  </span>
                )}
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Could not {e.step}</span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {' · '}{e.user_name ?? 'Unknown'}{e.user_role ? ` (${e.user_role})` : ''}{' · '}{formatTimestamp(e.created_at)}
                </span>
              </div>
              {e.message && (
                <div style={{ marginTop: '0.25rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {[e.message, e.details, e.hint ? `hint: ${e.hint}` : null].filter(Boolean).join('\n')}
                </div>
              )}
              {e.page && <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--color-muted)', overflowWrap: 'anywhere' }}>on {e.page}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8125rem',
          lineHeight: 1.8, maxHeight: '70vh', overflowY: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {entries.map((e) => (
            <div key={e.id}>{buildLine(e)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
