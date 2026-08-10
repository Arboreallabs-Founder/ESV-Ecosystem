'use client'

import { useState } from 'react'
import { alertError } from '@/lib/client-errors'
import type { ActivityLogEntry } from '@/lib/types'
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

export default function ActivityLogClient({ entries }: { entries: ActivityLogEntry[] }) {
  const [copied, setCopied] = useState(false)

  const fullText = entries.map(buildLine).join('\n')

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
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Activity Log</div>
          <div className={styles.pageSub}>
            Timestamped record of investor, HR policy, and event edits.
          </div>
        </div>
        {entries.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.addBtn} onClick={handleCopy}>{copied ? 'Copied!' : 'Copy all'}</button>
            <button className={styles.addBtn} onClick={handleDownload}>Download .txt</button>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className={styles.empty}>No edits recorded yet.</div>
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
