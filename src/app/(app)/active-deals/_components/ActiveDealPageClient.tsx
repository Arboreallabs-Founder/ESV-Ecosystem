'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createOrLinkCompanyForActiveDeal, deleteActiveDeal, linkActiveDealToCompany, setDealPartnerVisibility, updateActiveDealDetails, updateDealState } from '@/app/actions/active-deals'
import { addAssignee, removeAssignee } from '@/app/actions/pipelines'
import type { ActiveDeal, ActiveDealDocument, ActiveDealInvestor, ActiveDealInvestorStatus, ActiveDealUpdate, DealCategory, DealState, PartnerDealSummary, PipelineEntryStageHistory, StageAnswerView } from '@/lib/types'
import { ACTIVE_DEAL_INVESTOR_STATUSES, ACTIVE_DEAL_INVESTOR_STATUS_META, DEAL_STATES, DEAL_STATE_META, SERVICE_TYPE_LABELS } from '@/lib/types'
import { computeFeeAmount } from '@/lib/deal-fees'
import { StatusGauge, StatusDonut, type DonutSegment } from './DealCharts'
import DealUpdates from './DealUpdates'
import DealDocuments from './DealDocuments'
import Avatar from '@/app/_components/Avatar'
import PersonCard, { type PersonDetail } from '@/app/_components/PersonCard'
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
  updates,
  currentUserId,
  partnerSummary,
  documents,
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
  teamMembers: Array<{
    id: string; name: string; photo_url: string | null
    designation?: string | null; email?: string | null; phone?: string | null
  }>
  updates: ActiveDealUpdate[]
  currentUserId: string
  /** Partners only, and null for everyone else. See fetchPartnerDealSummary. */
  partnerSummary: PartnerDealSummary | null
  /** IM / financials / deck / MIS / data room. Already scoped by RLS to what this role may read. */
  documents: ActiveDealDocument[]
}) {
  const router = useRouter()
  const [dealState, setDealState] = useState<DealState>(deal.deal_state)
  const [partnerVisible, setPartnerVisible] = useState(deal.visible_to_partners !== false)
  const [visibilityPending, startVisibilityTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)
  const [companyId, setCompanyId] = useState(deal.entry?.company_id ?? '')
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string } | null>(
    deal.entry?.company ? { id: deal.entry.company.id, name: deal.entry.company.name } : null,
  )
  // Partners cannot read the user directory, so the join comes back empty for them and the panel
  // said "No one assigned" on a deal that has an owner. The summary carries name and photo only.
  const [contactPerson, setContactPerson] = useState<PersonDetail | null>(null)

  /**
   * Fill in the contact details behind an assignee chip.
   *
   * Internal users get them from the team roster. A partner cannot read that table at all, so for
   * them the details ride along on the partner summary — same shape, different source.
   */
  function personFor(userId: string, name: string, photoUrl: string | null): PersonDetail {
    const fromTeam = teamMembers.find((m) => m.id === userId)
    const fromSummary = partnerSummary?.assignees?.find((a) => a.user_id === userId)
    return {
      user_id: userId,
      name,
      photo_url: photoUrl,
      designation: fromTeam?.designation ?? fromSummary?.designation ?? null,
      email: fromTeam?.email ?? fromSummary?.email ?? null,
      phone: fromTeam?.phone ?? fromSummary?.phone ?? null,
    }
  }
  const [assignees, setAssignees] = useState(
    (deal.entry?.assignees?.length ? deal.entry.assignees : partnerSummary?.assignees ?? []).map((a) => ({
      user_id: a.user_id,
      name: a.name ?? 'Unknown',
      photo_url: a.photo_url ?? null,
    })),
  )
  const [, startStateTransition] = useTransition()
  const [linkPending, startLinkTransition] = useTransition()
  const [, startAssigneeTransition] = useTransition()

  function handleTogglePartnerVisibility() {
    const next = !partnerVisible
    setPartnerVisible(next)
    startVisibilityTransition(async () => {
      try {
        await setDealPartnerVisibility(deal.id, next)
        router.refresh()
      } catch (err) {
        setPartnerVisible(!next)   // put the switch back if the server refused
        alertError(err)
      }
    })
  }

  const canEditState = !['franchise_partner', 'general'].includes(userRole)
  const canManageDeal = !['franchise_partner', 'general'].includes(userRole)
  const canAssignPeople = ['founder', 'admin'].includes(userRole)
  const canDeleteDeal = ['founder', 'admin'].includes(userRole)
  // Showing a deal to partners is a disclosure decision, not an edit — leads only.
  const canSetPartnerVisibility = ['founder', 'admin'].includes(userRole)
  const isPartner = userRole === 'franchise_partner'
  // A partner sees HOW MUCH has been raised, never BY WHOM. The names on a cap table are the
  // relationships we are paid for; the progress number is what a referrer legitimately wants to
  // know about a deal they sourced.
  const canViewInvestors = userRole !== 'general' && !isPartner
  const canSeeRaiseProgress = userRole !== 'general'
  // Mirrors the active_deal_updates INSERT policy: leaders, or whoever is running the mandate.
  const canPostUpdate = ['founder', 'admin'].includes(userRole)
    || assignees.some((a) => a.user_id === currentUserId)
  const [deletePending, startDeleteTransition] = useTransition()

  function handleDeleteDeal() {
    if (!confirm(`Delete "${deal.entry?.title ?? 'this deal'}"? This removes the deal and its original pipeline entry entirely — this cannot be undone.`)) return
    startDeleteTransition(async () => {
      try {
        await deleteActiveDeal(deal.id)
        router.push('/active-deals')
      } catch (err) { alertError(err) }
    })
  }

  function handleAddAssignee(userId: string) {
    const member = teamMembers.find((m) => m.id === userId)
    if (!member) return
    setAssignees((prev) => [...prev, { user_id: userId, name: member.name, photo_url: member.photo_url }])
    startAssigneeTransition(async () => {
      try { await addAssignee(deal.pipeline_entry_id, userId) }
      catch (err) { setAssignees((prev) => prev.filter((a) => a.user_id !== userId)); alertError(err) }
    })
  }

  function handleRemoveAssignee(userId: string) {
    const prevAssignees = assignees
    setAssignees((prev) => prev.filter((a) => a.user_id !== userId))
    startAssigneeTransition(async () => {
      try { await removeAssignee(deal.pipeline_entry_id, userId) }
      catch (err) { setAssignees(prevAssignees); alertError(err) }
    })
  }

  function handleStateChange(next: DealState) {
    const prev = dealState
    setDealState(next)
    startStateTransition(async () => {
      try { await updateDealState(deal.id, next) }
      catch (err) { setDealState(prev); alertError(err) }
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
      } catch (err) { alertError(err) }
    })
  }

  function handleCreateCompanyProfile() {
    startLinkTransition(async () => {
      try {
        const id = await createOrLinkCompanyForActiveDeal(deal.id)
        setCompanyId(id)
        setLinkedCompany(companyOptions.find((c) => c.id === id) ?? { id, name: deal.entry?.title ?? 'Company profile' })
        router.refresh()
      } catch (err) { alertError(err) }
    })
  }

  // A logo set directly on the deal wins; otherwise fall back to the linked company's logo.
  // A partner cannot read `companies`, so the company logo arrives through the summary instead.
  // Without this the deal wore a coloured initial for them and its real mark for us.
  const displayLogoUrl = deal.logo_url || deal.entry?.company?.logo_url || partnerSummary?.logo_url || null

  const stageAnswerGroups: Array<{ stage_id: string; stage_name: string; items: StageAnswerView[] }> = []
  for (const a of stageAnswers) {
    let g = stageAnswerGroups.find((x) => x.stage_id === a.stage_id)
    if (!g) { g = { stage_id: a.stage_id, stage_name: a.stage_name, items: [] }; stageAnswerGroups.push(g) }
    g.items.push(a)
  }

  const meta = DEAL_STATE_META[dealState]
  const visibleAnswers = answers.filter((a) => a.node?.question_text)

  // ── Investor aggregates ───────────────────────────────────────────────────────
  // RLS hides every investor row from partners, correctly — but these sums were derived from those
  // rows, so a partner was shown "₹0 committed, 0 commitments" on a deal that was ₹1.08 Cr in. The
  // summary carries the totals computed server-side; the rows stay hidden.
  const totalCommitted = partnerSummary
    ? partnerSummary.committed_total
    : investors.reduce((s, i) => s + (i.investment_amount ?? 0), 0)
  const commitmentCount = partnerSummary ? partnerSummary.commitment_count : investors.length

  // What the company is raising, read off a field the partner can already see. Deliberately not
  // sent by the summary: a percentage whose denominator is not on the page is a number nobody can
  // check, and if the field is closed to partners the bar should disappear with it.
  const partnerTarget = (() => {
    if (!isPartner) return null
    for (const { category, field_values } of deal.categories) {
      for (const f of category.fields) {
        if (!f.visible_to_partners) continue
        if (!/capital being raised/i.test(f.label)) continue
        const raw = field_values.find((v) => v.field_id === f.id)?.value
        const n = raw ? Number(String(raw).replace(/[^0-9.]/g, '')) : NaN
        if (Number.isFinite(n) && n > 0) return n
      }
    }
    return null
  })()
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
            {/* Only meaningful on IB deals; the page itself explains the gate rather than the
                button vanishing without a reason. */}
            {canManageDeal && (
              <Link href={`/active-deals/${deal.id}/investor-lists`} className={styles.ghostBtn}
                style={{ textDecoration: 'none' }}>
                Investor lists
              </Link>
            )}
            {canSetPartnerVisibility && (
              <button
                className={partnerVisible ? styles.ghostBtn : styles.hiddenFromPartnersBtn}
                onClick={handleTogglePartnerVisibility}
                disabled={visibilityPending}
                title={partnerVisible
                  ? 'Partners can see this deal in their portal. Click to hide it.'
                  : 'Hidden from the partner portal. Click to show it.'}
              >
                {partnerVisible ? 'Visible to partners' : 'Hidden from partners'}
              </button>
            )}
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
      {isPartner && canSeeRaiseProgress && (
        <div className={styles.dashCard}>
          <div className={styles.detailSectionTitle}>Raise progress</div>
          {/* The percentage is the thing a partner actually wants: "is this deal nearly done".
              Only shown when the target is a field they can already see, so the bar never implies
              a number that is not on the page. */}
          {partnerTarget != null && partnerTarget > 0 && (
            <div className={styles.raiseBarWrap}>
              <div className={styles.raiseBar}>
                <div
                  className={styles.raiseBarFill}
                  style={{ width: `${Math.min(100, Math.round((totalCommitted / partnerTarget) * 100))}%` }}
                />
              </div>
              <span className={styles.raiseBarLabel}>
                {Math.round((totalCommitted / partnerTarget) * 100)}% of {formatINR(partnerTarget)}
              </span>
            </div>
          )}
          <div className={styles.statRow}>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>Committed so far</span>
              <span className={styles.statValueHero}>{formatINR(totalCommitted)}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>Commitments</span>
              {/* A count, not a list. Knowing five investors are in tells a partner the deal is
                  moving; knowing which five is ours. */}
              <span className={styles.statValue}>{commitmentCount}</span>
            </div>
          </div>
        </div>
      )}

      {canViewInvestors && (
        <>
          <div className={styles.statRow}>
            <div className={`${styles.statTile} ${styles.statTileHero}`}>
              <span className={styles.statLabel}>Total Committed</span>
              <span className={styles.statValueHero}>{formatINR(totalCommitted)}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statLabel}>Investors</span>
              <span className={styles.statValue}>{commitmentCount}</span>
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
        {/* Company Profile — internal only. A partner cannot read the company database, so for
            them this panel could only ever say "none linked", which reads as broken rather than as
            a boundary. The company's name is already the title of the deal. */}
        {!isPartner && (
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
        )}

        {/* Assigned To */}
        <div className={styles.dashCard}>
          <div className={styles.detailSectionTitle}>Assigned To</div>
          {canAssignPeople ? (
            <div className={styles.assigneeChips}>
              {assignees.map((a) => (
                <span key={a.user_id} className={styles.assigneeChip}>
                  <button
                    type="button"
                    className={styles.assigneeChipOpen}
                    onClick={() => setContactPerson(personFor(a.user_id, a.name, a.photo_url))}
                    title={`Contact ${a.name}`}
                  >
                    <Avatar name={a.name} photoUrl={a.photo_url} size="xs" />
                    {a.name}
                  </button>
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
              {/* A name answers "who owns this". The next question is always "how do I reach
                  them", and until now that meant asking someone. */}
              {assignees.map((a) => (
                <button
                  key={a.user_id}
                  type="button"
                  className={styles.detailAssigneeChipBtn}
                  onClick={() => setContactPerson(personFor(a.user_id, a.name, a.photo_url))}
                  title={`Contact ${a.name}`}
                >
                  <Avatar name={a.name} photoUrl={a.photo_url} size="xs" />
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Documents. The one panel a partner opens this page for, so it sits with the facts
            rather than at the bottom with our own process. */}
        <DealDocuments
          dealId={deal.id}
          documents={documents}
          canEdit={['founder', 'admin', 'associate'].includes(userRole)}
          isPartner={isPartner}
          companyName={deal.entry?.title ?? 'this company'}
          intro={deal.entry?.company?.share_intro
            ?? deal.entry?.company?.one_liner
            ?? partnerSummary?.company_share_intro
            ?? null}
          companyId={deal.entry?.company_id ?? null}
          canEditIntro={['founder', 'admin', 'associate'].includes(userRole)}
          canShare={userRole !== 'general'}
        />

        {/* Category fields */}
        {deal.categories.length > 0 && (
          <div className={styles.dashCard}>
            <div className={styles.detailSectionTitle}>Category Details</div>
            {deal.categories.map(({ category, field_values }) => {
              // Partners see only fields explicitly opened to them. A category left with nothing
              // visible is dropped entirely rather than rendered as an empty heading, which would
              // advertise that there is something here they cannot see.
              const visibleFields = isPartner
                ? category.fields.filter((f) => f.visible_to_partners)
                : category.fields
              if (isPartner && visibleFields.length === 0) return null
              return (
              <div key={category.id} className={styles.detailCategoryBlock}>
                <div className={styles.detailCategoryName} style={{ color: category.color }}>
                  <span className={styles.catDot} style={{ background: category.color }} />
                  {category.name}
                </div>
                {visibleFields.length === 0 ? (
                  <div className={styles.detailEmpty}>No fields defined.</div>
                ) : (
                  visibleFields.map((field) => {
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
              )
            })}
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

        {/* Latest update thread */}
        {userRole !== 'franchise_partner' && (
          <DealUpdates
            activeDealId={deal.id}
            updates={updates}
            canPost={canPostUpdate}
            currentUserId={currentUserId}
            isAdmin={['founder', 'admin'].includes(userRole)}
          />
        )}

        {/* Stage history — internal only. It is a record of our own process, and the query behind
            it returns nothing for a partner anyway. */}
        {!isPartner && (
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
        )}

        {/* Form Q&A — internal only, for the same reason: it is the founder's application, not
            something a referrer is owed. */}
        {!isPartner && (
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
        )}
      </div>

      {contactPerson && <PersonCard person={contactPerson} onClose={() => setContactPerson(null)} />}

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
