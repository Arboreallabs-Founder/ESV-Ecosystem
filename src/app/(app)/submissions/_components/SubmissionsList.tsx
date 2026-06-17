'use client'

import type { SubmissionEntry } from '../page'
import styles from '../submissions.module.css'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SubmissionsList({ entries }: { entries: SubmissionEntry[] }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Submissions</h1>
          <p className={styles.pageSubtitle}>Pipeline entries sourced through your form links</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          No submissions yet. Share your form links to receive applications.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableHead}>
            <span>Company</span>
            <span>Pipeline</span>
            <span>Stage</span>
            <span>Submitted</span>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className={styles.tableRow}>
              <span className={styles.cellName}>{entry.title ?? 'Untitled'}</span>
              <span className={styles.cellPipeline}>{entry.pipeline?.name ?? '—'}</span>
              <span className={styles.cellStage}>
                {entry.stage ? (
                  <span
                    className={styles.stageChip}
                    style={{
                      background: `${entry.stage.color}18`,
                      color: entry.stage.color,
                      borderColor: `${entry.stage.color}40`,
                    }}
                  >
                    {entry.stage.name}
                  </span>
                ) : '—'}
              </span>
              <span className={styles.cellDate}>{formatDate(entry.submitted_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
