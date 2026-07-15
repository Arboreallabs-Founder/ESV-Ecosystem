'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getEntryAnswers, getEntryStageHistory, getEntryStageAnswers } from '@/app/actions/pipelines'
import { createOrLinkCompanyForActiveDeal, linkActiveDealToCompany, updateActiveDealDetails, updateDealState } from '@/app/actions/active-deals'
import type { ActiveDeal, DealCategory, DealState, PipelineEntryStageHistory, StageAnswerView } from '@/lib/types'
import { DEAL_STATES, DEAL_STATE_META } from '@/lib/types'
import styles from '../active-deals.module.css'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

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
  if (fieldType === 'boolean') return value === 'true' ? 'Yes' : 'No'
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

export default function ActiveDealPageClient({
  deal,
  userRole,
  categories,
  companyOptions,
  investorSummary,
}: {
  deal: ActiveDeal
  userRole: string
  categories: DealCategory[]
  companyOptions: Array<{ id: string; name: string }>
  investorSummary: { count: number; totalCommitted: number }
}) {
  const router = useRouter()
  const [dealState, setDealState] = useState<DealState>(deal.deal_state)
  const [showEdit, setShowEdit] = useState(false)
  const [companyId, setCompanyId] = useState(deal.entry?.company_id ?? '')
  const [linkedCompany, setLinkedCompany] = useState(deal.entry?.company ?? null)
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [history, setHistory] = useState<PipelineEntryStageHistory[]>([])
  const [stageAnswers, setStageAnswers] = useState<StageAnswerView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, startStateTransition] = useTransition()
  const [linkPending, startLinkTransition] = useTransition()

  const canEditState = userRole !== 'franchise_partner'
  const canManageDeal = userRole !== 'franchise_partner'

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
    startStateTransition(async () => {
      try { await updateDealState(deal.id, next) }
      catch (err) { setDealState(prev); alert(String(err)) }
    })
  }

  function handleCompanyLink(nextCompanyId: string | null) {
    startLinkTransition(async () => {
      try {
        await linkActiveDealToCompany(deal.id, nextCompanyId)
        const company = companyOptions.find((c) => c.id === nextCompanyId) ?? null
        setCompanyId(nextCompanyId ?? '')
        setLinkedCompany(company)
        router.refresh()
      } catch (err) { alert(String(err)) }
    })
  }

  function handleCreateCompanyProfile() {
    startLinkTransition(async () => {
      try {
        const id = await createOrLinkCompanyForActiveDeal(deal.id)
        setCompanyId(id)
        setLinkedCompany(companyOptions.find((c) => c.id === id) ?? { id, name: deal.entry?.title ?? 'Company profile' })
        router.refresh()
      } catch (err) { alert(String(err)) }
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
          <div className={styles.detailHeadRight}>
            <select
              className={styles.stateSelect}
              value={dealState}
              onChange={(e) => handleStateChange(e.target.value as DealState)}
              style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}
              title="Change deal state"
            >
              {DEAL_STATES.map((s) => <option key={s} value={s} style={{ color: 'var(--color-text)' }}>{DEAL_STATE_META[s].label}</option>)}
            </select>
            {canManageDeal && <button className={styles.ghostBtn} onClick={() => setShowEdit(true)}>Edit deal</button>}
          </div>
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
            <div className={styles.detailSection}>
              <div className={styles.detailSectionHead}>
                <div className={styles.detailSectionTitle}>Company Profile</div>
                {linkedCompany && <Link href={`/companies/${linkedCompany.id}`} className={styles.inlineLink}>View profile</Link>}
              </div>
              {canManageDeal ? (
                <div className={styles.companyLinkBox}>
                  <select
                    className={styles.formSelect}
                    value={companyId}
                    disabled={linkPending}
                    onChange={(e) => handleCompanyLink(e.target.value || null)}
                  >
                    <option value="">No linked company profile</option>
                    {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                  <button className={styles.ghostBtn} disabled={linkPending} onClick={handleCreateCompanyProfile}>
                    {linkedCompany ? 'Relink by name' : 'Create/link by name'}
                  </button>
                </div>
              ) : linkedCompany ? (
                <div className={styles.detailEmpty}>{linkedCompany.name}</div>
              ) : (
                <div className={styles.detailEmpty}>No company profile linked.</div>
              )}
            </div>

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

          {/* RIGHT — Investors summary */}
          <div className={styles.dealPageAside}>
            <div className={styles.detailSectionTitle}>Investors</div>
            <div className={styles.investorSummaryStat}>
              <span className={styles.investorSummaryCount}>{investorSummary.count}</span>
              <span className={styles.investorSummaryLabel}>investor{investorSummary.count === 1 ? '' : 's'}</span>
            </div>
            <div className={styles.investorSummaryTotal}>{formatINR(investorSummary.totalCommitted)} committed</div>
            <Link href={`/active-deals/${deal.id}/investors`} className={styles.viewInvestorsBtn}>Open investor table →</Link>
          </div>
        </div>
      )}
      {showEdit && (
        <EditActiveDealModal
          deal={deal}
          categories={categories}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function EditActiveDealModal({
  deal,
  categories,
  onClose,
  onSaved,
}: {
  deal: ActiveDeal
  categories: DealCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const initialCategoryId = deal.categories[0]?.category.id ?? ''
  const [name, setName] = useState(deal.entry?.title ?? '')
  const [submitterName, setSubmitterName] = useState(deal.entry?.submitter_name ?? '')
  const [submitterEmail, setSubmitterEmail] = useState(deal.entry?.submitter_email ?? '')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const group of deal.categories) {
      for (const value of group.field_values) out[value.field_id] = value.value ?? ''
    }
    return out
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const category = categories.find((c) => c.id === categoryId) ?? null

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Deal name is required.'); return }
    startTransition(async () => {
      try {
        await updateActiveDealDetails(deal.id, {
          deal_name: name,
          category_id: categoryId || null,
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          field_values: values,
        })
        onSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save deal.')
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={`${styles.modalPanel} ${styles.modalPanelWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Edit deal</div>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">x</button>
        </div>
        <div className={`${styles.modalBody} ${styles.modalScroll}`}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Deal / company name *</label>
            <input className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Contact name</label>
              <input className={styles.formInput} value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Contact email</label>
              <input className={styles.formInput} value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} />
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Category</label>
            <select className={styles.formSelect} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setValues({}) }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {category && category.fields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
              <div className={styles.formLabel} style={{ color: category.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', marginBottom: '0.6rem' }}>{category.name}</div>
              {category.fields.map((field) => (
                <div key={field.id} className={styles.formField}>
                  <label className={styles.formLabel}>{field.label}{field.required && ' *'}</label>
                  <input
                    className={styles.formInput}
                    value={values[field.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    inputMode={field.field_type === 'numeric' || field.field_type === 'percentage' ? 'decimal' : undefined}
                    placeholder={field.field_type === 'url' ? 'https://' : field.field_type === 'percentage' ? '%' : field.field_type === 'numeric' ? 'Number (no commas)' : ''}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalActions} style={{ padding: '0.85rem 1.375rem', borderTop: '1px solid var(--color-border)' }}>
          <button className={styles.modalCancel} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.modalAccept} onClick={submit} disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}
