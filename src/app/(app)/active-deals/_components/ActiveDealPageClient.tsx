'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createOrLinkCompanyForActiveDeal, deleteActiveDeal, linkActiveDealToCompany, updateActiveDealDetails, updateDealState } from '@/app/actions/active-deals'
import { addAssignee, removeAssignee } from '@/app/actions/pipelines'
import type { ActiveDeal, ActiveDealInvestor, ActiveDealInvestorStatus, DealCategory, DealState, PipelineEntryStageHistory, StageAnswerView } from '@/lib/types'
import { ACTIVE_DEAL_INVESTOR_STATUSES, ACTIVE_DEAL_INVESTOR_STATUS_META, DEAL_STATES, DEAL_STATE_META, SERVICE_TYPE_LABELS } from '@/lib/types'
import { computeFeeAmount } from '@/lib/deal-fees'
import { StatusGauge, StatusDonut, type DonutSegment } from './DealCharts'
import styles from '../active-deals.module.css'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

// Compact INR for tight spots (donut centre, legends): Cr / L for Indian magnitudes.
function formatINRShort(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 1 : 2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 1 : 2)} L`
  return formatINR(n)
}

type AnswerItem = {
  id: string
  answer_text: string | null
  node: { question_text: string | null; answer_type: string | null } | null
}

type FieldValue = { field_id: string; value: string | null }

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

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function serviceLabel(type: string | undefined): string {
  if (!type) return '—'
  return (SERVICE_TYPE_LABELS as Record<string, string>)[type] ?? type
}

export default function ActiveDealPageClient({
  deal,
  userRole,
  categories,
  companyOptions,
  investors,
  dealFieldValues,
  answers,
  history,
  stageAnswers,
  teamMembers,
}: {
  deal: ActiveDeal
  userRole: string
  categories: DealCategory[]
  companyOptions: Array<{ id: string; name: string }>
  investors: ActiveDealInvestor[]
  dealFieldValues: FieldValue[]
  answers: AnswerItem[]
  history: PipelineEntryStageHistory[]
  stageAnswers: StageAnswerView[]
  teamMembers: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [dealState, setDealState] = useState<DealState>(deal.deal_state)
  const [showEdit, setShowEdit] = useState(false)
  const [companyId, setCompanyId] = useState(deal.entry?.company_id ?? '')
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string } | null>(
    deal.entry?.company ? { id: deal.entry.company.id, name: deal.entry.company.name } : null,
  )
  const [assignees, setAssignees] = useState(deal.entry?.assignees ?? [])
  const [, startStateTransition] = useTransition()
  const [linkPending, startLinkTransition] = useTransition()
  const [, startAssigneeTransition] = useTransition()

  const canEditState = !['franchise_partner', 'general'].includes(userRole)
  const canManageDeal = !['franchise_partner', 'general'].includes(userRole)
  const canAssignPeople = ['founder', 'admin'].includes(userRole)
  const canDeleteDeal = ['founder', 'admin'].includes(userRole)
  const canViewInvestors = userRole !== 'general'
  const [deletePending, startDeleteTransition] = useTransition()

  function handleDeleteDeal() {
    if (!confirm(`Delete "${deal.entry?.title ?? 'this deal'}"? This removes the deal and its original pipeline entry entirely — this cannot be undone.`)) return
    startDeleteTransition(async () => {
      try {
        await deleteActiveDeal(deal.id)
        router.push('/active-deals')
      } catch (err) { alert(String(err)) }
    })
  }

  function handleAddAssignee(userId: string) {
    const member = teamMembers.find((m) => m.id === userId)
    if (!member) return
    setAssignees((prev) => [...prev, { user_id: userId, name: member.name }])
    startAssigneeTransition(async () => {
      try { await addAssignee(deal.pipeline_entry_id, userId) }
      catch (err) { setAssignees((prev) => prev.filter((a) => a.user_id !== userId)); alert(String(err)) }
    })
  }

  function handleRemoveAssignee(userId: string) {
    const prevAssignees = assignees
    setAssignees((prev) => prev.filter((a) => a.user_id !== userId))
    startAssigneeTransition(async () => {
      try { await removeAssignee(deal.pipeline_entry_id, userId) }
      catch (err) { setAssignees(prevAssignees); alert(String(err)) }
    })
  }

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

  // A logo set directly on the deal wins; otherwise fall back to the linked company's logo.
  const displayLogoUrl = deal.logo_url || deal.entry?.company?.logo_url || null

  const stageAnswerGroups: Array<{ stage_id: string; stage_name: string; items: StageAnswerView[] }> = []
  for (const a of stageAnswers) {
    let g = stageAnswerGroups.find((x) => x.stage_id === a.stage_id)
    if (!g) { g = { stage_id: a.stage_id, stage_name: a.stage_name, items: [] }; stageAnswerGroups.push(g) }
    g.items.push(a)
  }

  const meta = DEAL_STATE_META[dealState]
  const visibleAnswers = answers.filter((a) => a.node?.question_text)

  // ── Investor aggregates (all current-state; RLS scopes rows for partners) ──────
  const totalCommitted = investors.reduce((s, i) => s + (i.investment_amount ?? 0), 0)
  const totalShares = investors.reduce((s, i) => s + (i.shares ?? 0), 0)
  const totalEarnings = investors.reduce(
    (s, i) => s + i.fees.reduce((fs, f) => fs + (computeFeeAmount(f, i.investment_amount, dealFieldValues) ?? 0), 0),
    0,
  )
  const statusCounts = ACTIVE_DEAL_INVESTOR_STATUSES.reduce((acc, st) => {
    acc[st] = investors.filter((i) => i.status === st).length
    return acc
  }, {} as Record<ActiveDealInvestorStatus, number>)
  const committedByStatus: DonutSegment[] = ACTIVE_DEAL_INVESTOR_STATUSES.map((st) => {
    const m = ACTIVE_DEAL_INVESTOR_STATUS_META[st]
    const value = investors.filter((i) => i.status === st).reduce((s, i) => s + (i.investment_amount ?? 0), 0)
    return { label: m.label, value, color: m.color, valueLabel: formatINRShort(value) }
  })
  const topInvestors = [...investors]
    .sort((a, b) => (b.investment_amount ?? 0) - (a.investment_amount ?? 0))
    .slice(0, 6)

  return (
    <div className={styles.dealPage}>
      {/* Back link */}
      <button className={styles.backLink} onClick={() => router.push('/active-deals')}>← Active Deals</button>

      {/* Header */}
      <div className={styles.dealPageHeader}>
        <div className={styles.dealPageHeaderLeft}>
          <div className={`${styles.logoLg} ${displayLogoUrl ? styles.logoImg : ''}`}>
            {displayLogoUrl ? <img src={displayLogoUrl} alt="" /> : initials(deal.entry?.title ?? '?')}
          </div>
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
            {canDeleteDeal && (
              <button className={styles.dangerBtn} onClick={handleDeleteDeal} disabled={deletePending}>
                {deletePending ? 'Deleting…' : 'Delete deal'}
              </button>
            )}
          </div>
        ) : (
          <span className={styles.stateBadge} style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}>
            {meta.label}
          </span>
        )}
      </div>

      {/* ── Investor dashboard (hidden from general) ─────────────────────────── */}
      {canViewInvestors && (
        <>
          <div className={styles.statRow}>
            <div className={`${styles.statTile} ${styles.statTileHero}`}>
              <span className={styles.statLabel}>Total Committed</span>
              <span className={styles.statValueHero}>{formatINR(totalCommitted)}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statLabel}>Investors</span>
              <span className={styles.statValue}>{investors.length}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statLabel}>Total Shares</span>
              <span className={styles.statValue}>{totalShares.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statLabel}>ESV Earnings</span>
              <span className={styles.statValue}>{formatINR(totalEarnings)}</span>
            </div>
          </div>

          <div className={styles.chartRow}>
            <div className={styles.dashCard}>
              <div className={styles.detailSectionTitle}>Investor Status</div>
              {investors.length === 0 ? (
                <div className={styles.chartEmpty}>No investors added yet.</div>
              ) : (
                <StatusGauge counts={statusCounts} total={investors.length} />
              )}
            </div>
            <div className={styles.dashCard}>
              <div className={styles.detailSectionTitle}>Committed by Status</div>
              <StatusDonut segments={committedByStatus} centerValue={formatINRShort(totalCommitted)} centerLabel="Committed" />
            </div>
          </div>

          <div className={styles.dashCard}>
            <div className={styles.detailSectionHead}>
              <div className={styles.detailSectionTitle}>Top Investors</div>
              <Link href={`/active-deals/${deal.id}/investors`} className={styles.inlineLink}>Open full investor table →</Link>
            </div>
            {topInvestors.length === 0 ? (
              <div className={styles.detailEmpty}>No investors on this deal yet.</div>
            ) : (
              <div className={styles.topTable}>
                <div className={styles.topHead}>
                  <span>Investor</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span className={styles.topNum}>Commitment</span>
                </div>
                {topInvestors.map((inv) => {
                  const m = ACTIVE_DEAL_INVESTOR_STATUS_META[inv.status]
                  return (
                    <div key={inv.id} className={styles.topRow}>
                      <span className={styles.topName}>
                        <span className={styles.topNameText}>{inv.investor?.name}</span>
                        {inv.is_referral && <span className={styles.referralChip}>Referral</span>}
                      </span>
                      <span className={styles.topType}>{serviceLabel(inv.investor?.service_type)}</span>
                      <span>
                        <span className={styles.statusPill} style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}12` }}>
                          {m.label}
                        </span>
                      </span>
                      <span className={styles.topNum}>{inv.investment_amount != null ? formatINR(inv.investment_amount) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Deal detail cards ────────────────────────────────────────────────── */}
      <div className={styles.supportGrid}>
        {/* Company Profile */}
        <div className={styles.dashCard}>
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
        <div className={styles.dashCard}>
          <div className={styles.detailSectionTitle}>Assigned To</div>
          {canAssignPeople ? (
            <div className={styles.assigneeChips}>
              {assignees.map((a) => (
                <span key={a.user_id} className={styles.assigneeChip}>
                  {a.name}
                  <button className={styles.assigneeChipRemove} onClick={() => handleRemoveAssignee(a.user_id)} title="Remove">×</button>
                </span>
              ))}
              {(() => {
                const assignedIds = new Set(assignees.map((a) => a.user_id))
                const available = teamMembers.filter((m) => !assignedIds.has(m.id))
                if (available.length === 0) return null
                return (
                  <select
                    className={styles.assigneeAdd}
                    value=""
                    onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value) }}
                  >
                    <option value="">+ Add person</option>
                    {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )
              })()}
            </div>
          ) : assignees.length === 0 ? (
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
          <div className={styles.dashCard}>
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
          <div className={styles.dashCard}>
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
        <div className={styles.dashCard}>
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
        <div className={styles.dashCard}>
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
  const [name, setName] = useState(deal.entry?.title ?? '')
  const [submitterName, setSubmitterName] = useState(deal.entry?.submitter_name ?? '')
  const [submitterEmail, setSubmitterEmail] = useState(deal.entry?.submitter_email ?? '')
  const [logoUrl, setLogoUrl] = useState(deal.logo_url ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>(deal.categories.map((c) => c.category.id))
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const out: Record<string, Record<string, string>> = {}
    for (const group of deal.categories) {
      out[group.category.id] = {}
      for (const value of group.field_values) out[group.category.id][value.field_id] = value.value ?? ''
    }
    return out
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleCategory(id: string, checked: boolean) {
    setCategoryIds((prev) => checked ? [...prev, id] : prev.filter((c) => c !== id))
  }

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Deal name is required.'); return }
    startTransition(async () => {
      try {
        await updateActiveDealDetails(deal.id, {
          deal_name: name,
          selections: categoryIds.map((id) => ({ category_id: id, field_values: values[id] ?? {} })),
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          logo_url: logoUrl,
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

          <div className={styles.formField}>
            <label className={styles.formLabel}>Logo URL</label>
            <input className={styles.formInput} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            {!logoUrl && deal.entry?.company?.logo_url && (
              <div className={styles.helpText} style={{ marginTop: '0.3rem' }}>Left blank — using the linked company profile&apos;s logo.</div>
            )}
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

          {categories.length > 0 && (
            <div className={styles.formField}>
              <label className={styles.formLabel}>Categories <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
              <div className={styles.categoryCheckList}>
                {categories.map((cat) => (
                  <label key={cat.id} className={styles.categoryCheckRow}>
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(cat.id)}
                      onChange={(e) => toggleCategory(cat.id, e.target.checked)}
                    />
                    <span className={styles.catCheckDot} style={{ background: cat.color }} />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {categoryIds.map((catId) => {
            const cat = categories.find((c) => c.id === catId)
            if (!cat || cat.fields.length === 0) return null
            return (
              <div key={catId} className={styles.acceptFieldGroup}>
                <div className={styles.acceptFieldGroupLabel} style={{ color: cat.color }}>{cat.name}</div>
                {cat.fields.map((field) => (
                  <div key={field.id} className={styles.formField}>
                    <label className={styles.formLabel}>{field.label}{field.required && ' *'}</label>
                    <input
                      className={styles.formInput}
                      value={values[catId]?.[field.id] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [catId]: { ...prev[catId], [field.id]: e.target.value } }))}
                      inputMode={field.field_type === 'numeric' || field.field_type === 'percentage' ? 'decimal' : undefined}
                      placeholder={field.field_type === 'url' ? 'https://' : field.field_type === 'percentage' ? '%' : field.field_type === 'numeric' ? 'Number (no commas)' : ''}
                    />
                  </div>
                ))}
              </div>
            )
          })}

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
