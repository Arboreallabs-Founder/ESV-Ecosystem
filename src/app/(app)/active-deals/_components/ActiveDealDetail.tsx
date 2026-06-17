'use client'

import { useEffect, useState } from 'react'
import { getEntryAnswers, getEntryStageHistory } from '@/app/actions/pipelines'
import type { ActiveDeal, PipelineEntryStageHistory } from '@/lib/types'
import DealInvestorsSection from './DealInvestorsSection'
import styles from '../active-deals.module.css'

type AnswerItem = {
  id: string
  answer_text: string | null
  node: { question_text: string | null; answer_type: string | null } | null
}

function formatValue(value: string, fieldType: string) {
  if (fieldType === 'url') {
    try {
      const url = new URL(value)
      return <a href={url.href} target="_blank" rel="noopener noreferrer" className={styles.fieldLink}>{url.hostname.replace('www.', '')}</a>
    } catch { return value }
  }
  if (fieldType === 'percentage') return `${value}%`
  return value
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ActiveDealDetail({ deal, onClose }: { deal: ActiveDeal; onClose: () => void }) {
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [history, setHistory] = useState<PipelineEntryStageHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getEntryAnswers(deal.pipeline_entry_id),
      getEntryStageHistory(deal.pipeline_entry_id),
    ]).then(([ans, hist]) => {
      setAnswers(ans)
      setHistory(hist as PipelineEntryStageHistory[])
      setLoading(false)
    })
  }, [deal.pipeline_entry_id])

  const assignees = deal.entry?.assignees ?? []

  return (
    <div className={styles.detailOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.detailPanel} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>{deal.entry?.title ?? 'Untitled'}</div>
            <div className={styles.detailMeta}>
              {deal.entry?.submitter_name && <span>{deal.entry.submitter_name}</span>}
              {deal.entry?.submitter_email && <span className={styles.dealEmail}>{deal.entry.submitter_email}</span>}
              <span>Submitted {formatDate(deal.entry?.submitted_at ?? deal.created_at)}</span>
              <span>Accepted {formatDate(deal.created_at)}</span>
            </div>
            {deal.entry?.sourced_via_partner && (
              <span className={styles.partnerChip}>via {deal.entry.sourced_via_partner.name}</span>
            )}
          </div>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.detailBody}>
          {loading ? (
            <div className={styles.detailLoading} style={{ padding: '1.25rem 1.5rem' }}>Loading…</div>
          ) : (
            <>
              {/* LEFT — Deal details */}
              <div className={styles.detailLeft}>
                {/* Assigned To */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Assigned To</div>
                  {assignees.length === 0 ? (
                    <div className={styles.detailEmpty}>No one assigned.</div>
                  ) : (
                    <div className={styles.assigneeChips}>
                      {assignees.map((a) => (
                        <span key={a.user_id} className={styles.detailAssigneeChip}>{a.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category fields */}
                {deal.categories.length > 0 && (
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>Category Details</div>
                    {deal.categories.map(({ category, field_values }) => (
                      <div key={category.id} className={styles.detailCategoryBlock}>
                        <div className={styles.detailCategoryName} style={{ color: category.color }}>
                          <span className={styles.catDot} style={{ background: category.color }} />
                          {category.name}
                        </div>
                        {category.fields.length === 0 ? (
                          <div className={styles.detailEmpty}>No fields defined.</div>
                        ) : (
                          category.fields.map((field) => {
                            const fv = field_values.find((v) => v.field_id === field.id)
                            return (
                              <div key={field.id} className={styles.fieldValueRow}>
                                <span className={styles.fieldKey}>{field.label}</span>
                                <span className={styles.fieldVal}>
                                  {fv?.value ? formatValue(fv.value, field.field_type) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stage history */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Stage History</div>
                  {history.length === 0 ? (
                    <div className={styles.detailEmpty}>No history recorded.</div>
                  ) : (
                    <div className={styles.stageHistory}>
                      {history.map((h, i) => (
                        <div key={h.id} className={styles.stageHistoryRow}>
                          <div className={styles.stageHistoryDot} />
                          {i < history.length - 1 && <div className={styles.stageHistoryLine} />}
                          <div className={styles.stageHistoryContent}>
                            <span className={styles.stageHistoryLabel}>
                              {h.from_stage ? h.from_stage.name : 'Unsorted'} → {h.to_stage ? h.to_stage.name : 'Unsorted'}
                            </span>
                            <span className={styles.stageHistoryDate}>{formatDateTime(h.moved_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Q&A */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Form Responses</div>
                  {answers.length === 0 ? (
                    <div className={styles.detailEmpty}>No form answers recorded.</div>
                  ) : (
                    <div className={styles.answerList}>
                      {answers.filter((a) => a.node?.question_text).map((a) => (
                        <div key={a.id} className={styles.answerRow}>
                          <div className={styles.answerQuestion}>{a.node!.question_text}</div>
                          <div className={styles.answerText}>{a.answer_text || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — Investors */}
              <div className={styles.detailRight}>
                <DealInvestorsSection
                  dealId={deal.id}
                  dealTitle={deal.entry?.title ?? 'this deal'}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
