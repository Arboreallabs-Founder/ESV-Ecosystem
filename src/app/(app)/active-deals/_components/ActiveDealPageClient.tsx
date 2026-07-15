'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getEntryAnswers, getEntryStageHistory, getEntryStageAnswers } from '@/app/actions/pipelines'
import { updateDealState } from '@/app/actions/active-deals'
import type { ActiveDeal, DealState, PipelineEntryStageHistory, StageAnswerView } from '@/lib/types'
import { DEAL_STATES, DEAL_STATE_META } from '@/lib/types'
import DealInvestorsSection from './DealInvestorsSection'
import styles from '../active-deals.module.css'

type AnswerItem = {
  id: string
  answer_text: string | null
  node: { question_text: string | null; answer_type: string | null } | null
}

function delimitNumber(value: string): string {
  const raw = value.replace(/,/g, '').trim()
  if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) return value
  const n = Number(raw)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('en-IN')
}

function formatValue(value: string, fieldType: string) {
  if (fieldType === 'url') {
    try {
      const url = new URL(value)
      return <a href={url.href} target="_blank" rel="noopener noreferrer" className={styles.fieldLink}>{url.hostname.replace('www.', '')}</a>
    } catch { return value }
  }
  if (fieldType === 'percentage') return `${delimitNumber(value)}%`
  if (fieldType === 'numeric') return delimitNumber(value)
  return value
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ActiveDealPageClient({ deal, userRole }: { deal: ActiveDeal; userRole: string }) {
  const router = useRouter()
  const [dealState, setDealState] = useState<DealState>(deal.deal_state)
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [history, setHistory] = useState<PipelineEntryStageHistory[]>([])
  const [stageAnswers, setStageAnswers] = useState<StageAnswerView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const canEditState = userRole !== 'franchise_partner'
  const isReadOnly = userRole === 'franchise_partner'

  useEffect(() => {
    Promise.all([
      getEntryAnswers(deal.pipeline_entry_id),
      getEntryStageHistory(deal.pipeline_entry_id),
      getEntryStageAnswers(deal.pipeline_entry_id),
    ])
      .then(([ans, hist, stageAns]) => {
        setAnswers(ans)
        setHistory(hist as PipelineEntryStageHistory[])
        setStageAnswers(stageAns)
        setLoadError(null)
      })
      .catch((err) => setLoadError(String(err)))
      .finally(() => setLoading(false))
  }, [deal.pipeline_entry_id])

  function handleStateChange(next: DealState) {
    const prev = dealState
    setDealState(next)
    startTransition(async () => {
      try { await updateDealState(deal.id, next) }
      catch (err) { setDealState(prev); alert(String(err)) }
    })
  }

  const stageAnswerGroups: Array<{ stage_id: string; stage_name: string; items: StageAnswerView[] }> = []
  for (const a of stageAnswers) {
    let g = stageAnswerGroups.find((x) => x.stage_id === a.stage_id)
    if (!g) { g = { stage_id: a.stage_id, stage_name: a.stage_name, items: [] }; stageAnswerGroups.push(g) }
    g.items.push(a)
  }

  const assignees = deal.entry?.assignees ?? []
  const meta = DEAL_STATE_META[dealState]
  const categoryNames = deal.categories.map(({ category }) => category.name)
  const visibleAnswers = answers.filter((a) => a.node?.question_text)
  const summaryItems = [
    { label: 'Submitter', value: deal.entry?.submitter_name ?? 'Not recorded' },
    { label: 'Assigned', value: assignees.length > 0 ? `${assignees.length} owner${assignees.length === 1 ? '' : 's'}` : 'Unassigned' },
    { label: 'Categories', value: categoryNames.length > 0 ? categoryNames.join(', ') : 'Uncategorised' },
    { label: 'Accepted', value: formatDate(deal.created_at) },
  ]

  return (
    <div className={styles.dealPage}>
      {/* Back link */}
      <button className={styles.backLink} onClick={() => router.push('/active-deals')}>← Active Deals</button>

      {/* Header */}
      <div className={styles.dealPageHeader}>
        <div className={styles.dealPageHeaderMain}>
          <h1 className={styles.dealPageTitle}>{deal.entry?.title ?? 'Untitled'}</h1>
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
        {canEditState ? (
          <select
            className={styles.stateSelect}
            value={dealState}
            onChange={(e) => handleStateChange(e.target.value as DealState)}
            style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}
            title="Change deal state"
          >
            {DEAL_STATES.map((s) => <option key={s} value={s} style={{ color: 'var(--color-text)' }}>{DEAL_STATE_META[s].label}</option>)}
          </select>
        ) : (
          <span className={styles.stateBadge} style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}>
            {meta.label}
          </span>
        )}
      </div>

      <div className={styles.summaryRail}>
        {summaryItems.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <span className={styles.summaryValue}>{item.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className={styles.detailLoading} style={{ padding: '1.25rem 0' }}>Loading…</div>
      ) : loadError ? (
        <div className={styles.detailError}>Could not load the full deal record. {loadError}</div>
      ) : (
        <div className={styles.dealPageGrid}>
          {/* LEFT — Deal details */}
          <div className={styles.dealPageMain}>
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

            {/* Stage inputs */}
            {stageAnswerGroups.length > 0 && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Stage Inputs</div>
                {stageAnswerGroups.map((g) => (
                  <div key={g.stage_id} className={styles.detailCategoryBlock}>
                    <div className={styles.detailCategoryName}>{g.stage_name}</div>
                    {g.items.map((a) => (
                      <div key={a.question_id} className={styles.fieldValueRow}>
                        <span className={styles.fieldKey}>{a.label}</span>
                        <span className={styles.fieldVal}>
                          {a.value ? formatValue(a.value, a.field_type) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                        </span>
                      </div>
                    ))}
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
              {visibleAnswers.length === 0 ? (
                <div className={styles.detailEmpty}>No form answers recorded.</div>
              ) : (
                <div className={styles.answerList}>
                  {visibleAnswers.map((a) => (
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
          <div className={styles.dealPageAside}>
            <DealInvestorsSection
              dealId={deal.id}
              dealTitle={deal.entry?.title ?? 'this deal'}
              isReadOnly={isReadOnly}
            />
          </div>
        </div>
      )}
    </div>
  )
}
