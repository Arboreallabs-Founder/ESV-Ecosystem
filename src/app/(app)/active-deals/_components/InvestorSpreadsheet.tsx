'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import Link from 'next/link'
import {
  getInvestorsForPicker,
  addInvestorsToDeal,
  removeInvestorFromDeal,
  updateDealInvestor,
  setDealInvestorCategory,
  upsertInvestorFee,
  toggleInvestorFee,
  deleteInvestorFee,
} from '@/app/actions/active-deals'
import type { ActiveDealInvestor, ActiveDealInvestorFee, ActiveDealInvestorStatus } from '@/lib/types'
import { ACTIVE_DEAL_INVESTOR_STATUSES, ACTIVE_DEAL_INVESTOR_STATUS_META, SERVICE_TYPE_LABELS } from '@/lib/types'
import { computeFeeAmount, getEffectiveRate } from '@/lib/deal-fees'
import InvestorPickerModal from './InvestorPickerModal'
import FeeToggleConfirmModal from './FeeToggleConfirmModal'
import InvestorFormModal from '../../investors/_components/InvestorFormModal'
import FilterTabs from '@/app/_components/FilterTabs'
import styles from '../active-deals.module.css'

type PickerInvestor = { id: string; name: string; service_type: string; referred_by_partner_id: string | null }
type FieldValue = { field_id: string; value: string | null }
type FeeColumn = { label: string; source_field_id: string | null }
type CategoryTab = { id: string; name: string; color: string }
const UNASSIGNED_TAB = 'unassigned'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

type Props = {
  dealId: string
  dealTitle: string
  categories: CategoryTab[]
  isReadOnly?: boolean
  initialInvestors: ActiveDealInvestor[]
  initialDealFieldValues: FieldValue[]
  initialAllInvestors: PickerInvestor[]
  initialInternalUsers: Array<{ id: string; name: string }>
  initialFranchisePartners: Array<{ id: string; name: string }>
}

export default function InvestorSpreadsheet({
  dealId,
  dealTitle,
  categories,
  isReadOnly = false,
  initialInvestors,
  initialDealFieldValues,
  initialAllInvestors,
  initialInternalUsers,
  initialFranchisePartners,
}: Props) {
  const [investors, setInvestors] = useState<ActiveDealInvestor[]>(initialInvestors)
  const dealFieldValues = initialDealFieldValues
  const [allInvestors, setAllInvestors] = useState<PickerInvestor[]>(initialAllInvestors)
  const internalUsers = initialInternalUsers
  const franchisePartners = initialFranchisePartners
  const [showPicker, setShowPicker] = useState(false)

  // Per-category investor tabs — only shown once the deal has 2+ categories; otherwise this
  // behaves exactly like the old single flat list (activeTab is irrelevant when there's ≤1 tab).
  // A category the deal no longer carries counts as unassigned too — the row is still real, and
  // filing it under a tab that isn't rendered would hide it from every view.
  const isUnassigned = useCallback(
    (inv: ActiveDealInvestor) => !inv.category_id || !categories.some((c) => c.id === inv.category_id),
    [categories],
  )
  const hasUnassigned = investors.some(isUnassigned)
  const tabs = [...categories.map((c) => ({ value: c.id, label: c.name, dot: c.color })), ...(hasUnassigned ? [{ value: UNASSIGNED_TAB, label: 'Unassigned' }] : [])]
  const [activeTab, setActiveTab] = useState<string>(categories[0]?.id ?? UNASSIGNED_TAB)
  const showTabs = tabs.length > 1
  const visibleInvestors = useMemo(
    () => showTabs
      ? investors.filter((inv) => activeTab === UNASSIGNED_TAB ? isUnassigned(inv) : inv.category_id === activeTab)
      : investors,
    [investors, activeTab, showTabs, isUnassigned],
  )
  const [showCreateInvestor, setShowCreateInvestor] = useState(false)
  const [showAddFeeColumn, setShowAddFeeColumn] = useState(false)
  const [newColumnLabel, setNewColumnLabel] = useState('')
  const [newColumnRate, setNewColumnRate] = useState('')
  const [editingFeeCell, setEditingFeeCell] = useState<{ investorId: string; feeId: string; rate: string } | null>(null)
  const [editingColumn, setEditingColumn] = useState<{ label: string; draft: string } | null>(null)
  const [feeTogglePending, setFeeTogglePending] = useState<{ fee: ActiveDealInvestorFee; investorId: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function mutateInvestor(id: string, updater: (inv: ActiveDealInvestor) => ActiveDealInvestor) {
    setInvestors((prev) => prev.map((inv) => inv.id === id ? updater(inv) : inv))
  }

  function handleAddInvestors(investorIds: string[]) {
    const categoryId = activeTab === UNASSIGNED_TAB ? null : activeTab
    startTransition(async () => {
      try {
        const newInvs = await addInvestorsToDeal(dealId, investorIds, categoryId)
        setInvestors((prev) => [...prev, ...newInvs])
      } catch (err) { alertError(err) }
    })
  }

  function handleRemoveInvestor(activeDealInvestorId: string) {
    startTransition(async () => {
      try {
        await removeInvestorFromDeal(activeDealInvestorId)
        setInvestors((prev) => prev.filter((inv) => inv.id !== activeDealInvestorId))
      } catch (err) { alertError(err) }
    })
  }

  // Status drives is_investing behind the scenes (partner-earnings math keys off it),
  // so this is the one control users need — no separate "investing?" toggle to remember.
  function handleStatusChange(inv: ActiveDealInvestor, next: ActiveDealInvestorStatus) {
    const prevStatus = inv.status
    const prevInvesting = inv.is_investing
    const nextInvesting = next !== 'not_started'
    mutateInvestor(inv.id, (i) => ({ ...i, status: next, is_investing: nextInvesting }))
    startTransition(async () => {
      try { await updateDealInvestor(inv.id, { status: next, is_investing: nextInvesting }) }
      catch (err) { mutateInvestor(inv.id, (i) => ({ ...i, status: prevStatus, is_investing: prevInvesting })); alertError(err) }
    })
  }

  // Moving a row out of the tab you are looking at makes it vanish from the list — which is what
  // "move" means, and the tab counts update in the same render so where it went is visible.
  function handleCategoryChange(inv: ActiveDealInvestor, next: string) {
    const categoryId = next === UNASSIGNED_TAB ? null : next
    const prev = inv.category_id
    // The Unassigned tab only exists while something is unassigned. Emptying it from inside would
    // otherwise leave the view on a tab that is no longer rendered, showing nothing — so follow the
    // row across. Only in that case: bulk-moving out of Unassigned should not yank the view after
    // the first row.
    if (activeTab === UNASSIGNED_TAB && categoryId && !investors.some((i) => i.id !== inv.id && isUnassigned(i))) {
      setActiveTab(categoryId)
    }
    mutateInvestor(inv.id, (i) => ({ ...i, category_id: categoryId }))
    startTransition(async () => {
      try { await setDealInvestorCategory(inv.id, categoryId) }
      catch (err) { mutateInvestor(inv.id, (i) => ({ ...i, category_id: prev })); alertError(err) }
    })
  }

  function handleAmountChange(inv: ActiveDealInvestor, raw: string) {
    const num = raw === '' ? null : Number(raw)
    mutateInvestor(inv.id, (i) => ({ ...i, investment_amount: isNaN(num as number) ? i.investment_amount : num }))
  }

  function handleAmountBlur(inv: ActiveDealInvestor) {
    startTransition(async () => {
      try { await updateDealInvestor(inv.id, { investment_amount: inv.investment_amount }) }
      catch (err) { alertError(err) }
    })
  }

  function handleSharesChange(inv: ActiveDealInvestor, raw: string) {
    const num = raw === '' ? null : Number(raw)
    mutateInvestor(inv.id, (i) => ({ ...i, shares: isNaN(num as number) ? i.shares : num }))
  }

  function handleSharesBlur(inv: ActiveDealInvestor) {
    startTransition(async () => {
      try { await updateDealInvestor(inv.id, { shares: inv.shares }) }
      catch (err) { alertError(err) }
    })
  }

  function startEditFeeRate(inv: ActiveDealInvestor, fee: ActiveDealInvestorFee) {
    setEditingFeeCell({ investorId: inv.id, feeId: fee.id, rate: fee.rate?.toString() ?? '' })
  }

  function saveFeeRate() {
    if (!editingFeeCell) return
    const { investorId, feeId, rate } = editingFeeCell
    const numRate = rate === '' ? null : Number(rate)
    setEditingFeeCell(null)
    mutateInvestor(investorId, (inv) => ({ ...inv, fees: inv.fees.map((f) => f.id === feeId ? { ...f, rate: numRate } : f) }))
    const investor = investors.find((i) => i.id === investorId)
    const fee = investor?.fees.find((f) => f.id === feeId)
    if (!fee) return
    startTransition(async () => {
      try { await upsertInvestorFee(investorId, { id: feeId, label: fee.label, rate: numRate, source_field_id: fee.source_field_id }) }
      catch (err) { alertError(err) }
    })
  }

  function handleFeeToggleConfirm(fee: ActiveDealInvestorFee, investorId: string) {
    const next = !fee.is_enabled
    mutateInvestor(investorId, (inv) => ({ ...inv, fees: inv.fees.map((f) => f.id === fee.id ? { ...f, is_enabled: next } : f) }))
    startTransition(async () => {
      try { await toggleInvestorFee(fee.id, next) }
      catch (err) {
        mutateInvestor(investorId, (inv) => ({ ...inv, fees: inv.fees.map((f) => f.id === fee.id ? { ...f, is_enabled: !next } : f) }))
        alertError(err)
      }
    })
  }

  function handleAddFeeToInvestor(inv: ActiveDealInvestor, col: FeeColumn) {
    startTransition(async () => {
      try {
        const newId = await upsertInvestorFee(inv.id, { label: col.label, rate: null, source_field_id: col.source_field_id })
        const newFee: ActiveDealInvestorFee = { id: newId!, label: col.label, rate: null, source_field_id: col.source_field_id, is_enabled: true }
        mutateInvestor(inv.id, (i) => ({ ...i, fees: [...i.fees, newFee] }))
      } catch (err) { alertError(err) }
    })
  }

  function handleDeleteFeeCell(inv: ActiveDealInvestor, fee: ActiveDealInvestorFee) {
    setEditingFeeCell(null)
    mutateInvestor(inv.id, (i) => ({ ...i, fees: i.fees.filter((f) => f.id !== fee.id) }))
    startTransition(async () => {
      try { await deleteInvestorFee(fee.id) }
      catch (err) { alertError(err) }
    })
  }

  function handleAddFeeColumn() {
    const label = newColumnLabel.trim()
    if (!label || visibleInvestors.length === 0) return
    const rate = newColumnRate === '' ? null : Number(newColumnRate)
    startTransition(async () => {
      try {
        const ids = await Promise.all(visibleInvestors.map((inv) => upsertInvestorFee(inv.id, { label, rate, source_field_id: null })))
        const newFeeByInvestorId = new Map(visibleInvestors.map((inv, i) => [inv.id, { id: ids[i]!, label, rate, source_field_id: null, is_enabled: true }]))
        setInvestors((prev) => prev.map((inv) => {
          const newFee = newFeeByInvestorId.get(inv.id)
          return newFee ? { ...inv, fees: [...inv.fees, newFee] } : inv
        }))
        setShowAddFeeColumn(false)
        setNewColumnLabel('')
        setNewColumnRate('')
      } catch (err) { alertError(err) }
    })
  }

  function handleDeleteFeeColumn(col: FeeColumn) {
    if (!confirm(`Remove the "${col.label}" column from every investor in this list?`)) return
    const feeIds = visibleInvestors.flatMap((inv) => inv.fees.filter((f) => f.label === col.label).map((f) => f.id))
    const feeIdSet = new Set(feeIds)
    setInvestors((prev) => prev.map((inv) => ({ ...inv, fees: inv.fees.filter((f) => !feeIdSet.has(f.id)) })))
    startTransition(async () => {
      try { await Promise.all(feeIds.map((id) => deleteInvestorFee(id))) }
      catch (err) { alertError(err) }
    })
  }

  function startEditColumn(col: FeeColumn) {
    setEditingColumn({ label: col.label, draft: col.label })
  }

  function saveColumnRename() {
    if (!editingColumn) return
    const { label: oldLabel, draft } = editingColumn
    const newLabel = draft.trim()
    setEditingColumn(null)
    if (!newLabel || newLabel === oldLabel) return
    const affected = visibleInvestors.flatMap((inv) => inv.fees.filter((f) => f.label === oldLabel).map((f) => ({ investorId: inv.id, fee: f })))
    if (affected.length === 0) return
    const affectedIds = new Set(affected.map((a) => a.investorId))
    setInvestors((prev) => prev.map((inv) => affectedIds.has(inv.id)
      ? { ...inv, fees: inv.fees.map((f) => f.label === oldLabel ? { ...f, label: newLabel } : f) }
      : inv))
    startTransition(async () => {
      try {
        await Promise.all(affected.map(({ investorId, fee }) =>
          upsertInvestorFee(investorId, { id: fee.id, label: newLabel, rate: fee.rate, source_field_id: fee.source_field_id })
        ))
      } catch (err) { alertError(err) }
    })
  }

  // One column per distinct fee label across the visible (tab-scoped) investors, in first-seen order.
  const feeColumns = useMemo<FeeColumn[]>(() => {
    const seen = new Map<string, FeeColumn>()
    for (const inv of visibleInvestors) {
      for (const fee of inv.fees) {
        if (!seen.has(fee.label)) seen.set(fee.label, { label: fee.label, source_field_id: fee.source_field_id })
      }
    }
    return [...seen.values()]
  }, [visibleInvestors])

  // Running total of commitment amounts in row order — matches the reference sheet.
  const rows = visibleInvestors.reduce<Array<{ inv: ActiveDealInvestor; cumulative: number }>>((acc, inv) => {
    const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0
    acc.push({ inv, cumulative: prevCumulative + (inv.investment_amount ?? 0) })
    return acc
  }, [])
  const runningTotal = rows.length > 0 ? rows[rows.length - 1].cumulative : 0

  const totalCommitment = visibleInvestors.reduce((sum, inv) => sum + (inv.investment_amount ?? 0), 0)
  const totalShares = visibleInvestors.reduce((sum, inv) => sum + (inv.shares ?? 0), 0)
  const feeColumnTotals = feeColumns.map((col) => ({
    label: col.label,
    total: visibleInvestors.reduce((sum, inv) => {
      const fee = inv.fees.find((f) => f.label === col.label)
      if (!fee) return sum
      return sum + (computeFeeAmount(fee, inv.investment_amount, dealFieldValues) ?? 0)
    }, 0),
  }))

  return (
    <div className={styles.dealPage}>
      <Link href={`/active-deals/${dealId}`} className={styles.backLink}>← {dealTitle}</Link>

      <div className={styles.dealPageHeader}>
        <div className={styles.dealPageHeaderMain}>
          <h1 className={styles.dealPageTitle}>Investors</h1>
          <div className={styles.detailMeta}>
            <span>{dealTitle}</span>
            {visibleInvestors.length > 0 && <span>{visibleInvestors.length} investor{visibleInvestors.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
        {!isReadOnly && (
          <div className={styles.detailHeadRight}>
            <button className={styles.ghostBtn} disabled={visibleInvestors.length === 0} onClick={() => setShowAddFeeColumn(true)}>+ Fee column</button>
            <button className={styles.primaryBtn} onClick={() => setShowPicker(true)}>+ Add investors</button>
          </div>
        )}
      </div>

      {showTabs && (
        <FilterTabs tabs={tabs.map((t) => ({ ...t, count: investors.filter((inv) => (t.value === UNASSIGNED_TAB ? isUnassigned(inv) : inv.category_id === t.value)).length }))} value={activeTab} onChange={setActiveTab} />
      )}

      {visibleInvestors.length === 0 ? (
        <div className={styles.empty}>
          No investors on this list yet.{!isReadOnly && ' Add one to start tracking commitments.'}
        </div>
      ) : (
        <div className={styles.sheetWrap}>
          <table className={styles.sheet}>
            <thead>
              <tr>
                <th className={styles.sheetSrNo}>Sr No</th>
                <th>Investor</th>
                {/* Only where there is somewhere to move to. On a single-category deal the column
                    would be one repeated value and a control with no second option. */}
                {showTabs && <th>Category</th>}
                <th>Status</th>
                <th className={styles.sheetNum}>Commitment Amount</th>
                <th className={styles.sheetNum}>No. of Shares</th>
                <th className={styles.sheetNum}>Cumulative Total</th>
                {feeColumns.map((col) => {
                  const isEditingCol = editingColumn?.label === col.label
                  return (
                    <th key={col.label} className={styles.sheetNum}>
                      {!isReadOnly && isEditingCol ? (
                        <input
                          className={styles.sheetColRenameInput}
                          autoFocus
                          value={editingColumn.draft}
                          onChange={(e) => setEditingColumn((prev) => prev ? { ...prev, draft: e.target.value } : prev)}
                          onBlur={saveColumnRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingColumn(null) }}
                        />
                      ) : (
                        <span className={styles.sheetFeeColHead}>
                          {!isReadOnly ? (
                            <button className={styles.sheetColLabelBtn} title="Rename column" onClick={() => startEditColumn(col)}>{col.label}</button>
                          ) : col.label}
                          {!isReadOnly && (
                            <button className={styles.sheetColRemove} title={`Remove ${col.label} column`} onClick={() => handleDeleteFeeColumn(col)}>×</button>
                          )}
                        </span>
                      )}
                    </th>
                  )
                })}
                {!isReadOnly && <th className={styles.sheetActionsCol} />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ inv, cumulative }, i) => {
                const statusMeta = ACTIVE_DEAL_INVESTOR_STATUS_META[inv.status]
                const currentCategory = categories.find((c) => c.id === inv.category_id)
                return (
                  <tr key={inv.id}>
                    <td className={styles.sheetSrNo}>{i + 1}</td>
                    <td>
                      <div className={styles.sheetInvestorCell}>
                        <span className={styles.investorName}>{inv.investor?.name}</span>
                        <span className={styles.investorTypeBadge}>
                          {(SERVICE_TYPE_LABELS as Record<string, string>)[inv.investor?.service_type] ?? inv.investor?.service_type}
                        </span>
                        {inv.is_referral && <span className={styles.referralChip}>Referral</span>}
                      </div>
                    </td>
                    {showTabs && (
                      <td>
                        {isReadOnly ? (
                          <span className={styles.sheetMuted}>{currentCategory?.name ?? 'Unassigned'}</span>
                        ) : (
                          <select
                            className={styles.investorCategorySelect}
                            value={currentCategory?.id ?? UNASSIGNED_TAB}
                            title="Move this commitment to another category"
                            onChange={(e) => handleCategoryChange(inv, e.target.value)}
                          >
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value={UNASSIGNED_TAB}>Unassigned</option>
                          </select>
                        )}
                      </td>
                    )}
                    <td>
                      {isReadOnly ? (
                        <span className={styles.stateBadge} style={{ color: statusMeta.color, borderColor: `${statusMeta.color}55`, background: `${statusMeta.color}12` }}>
                          {statusMeta.label}
                        </span>
                      ) : (
                        <select
                          className={styles.investorStatusSelect}
                          value={inv.status}
                          style={{ color: statusMeta.color, borderColor: `${statusMeta.color}55`, background: `${statusMeta.color}12` }}
                          onChange={(e) => handleStatusChange(inv, e.target.value as ActiveDealInvestorStatus)}
                        >
                          {ACTIVE_DEAL_INVESTOR_STATUSES.map((s) => (
                            <option key={s} value={s} style={{ color: 'var(--color-text)' }}>{ACTIVE_DEAL_INVESTOR_STATUS_META[s].label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={styles.sheetNum}>
                      {isReadOnly ? (
                        <span>{inv.investment_amount != null ? inv.investment_amount.toLocaleString('en-IN') : '—'}</span>
                      ) : (
                        <input
                          type="number"
                          className={styles.sheetCellInput}
                          value={inv.investment_amount ?? ''}
                          onChange={(e) => handleAmountChange(inv, e.target.value)}
                          onBlur={() => handleAmountBlur(inv)}
                          placeholder="—"
                        />
                      )}
                    </td>
                    <td className={styles.sheetNum}>
                      {isReadOnly ? (
                        <span>{inv.shares != null ? inv.shares.toLocaleString('en-IN') : '—'}</span>
                      ) : (
                        <input
                          type="number"
                          className={styles.sheetCellInput}
                          value={inv.shares ?? ''}
                          onChange={(e) => handleSharesChange(inv, e.target.value)}
                          onBlur={() => handleSharesBlur(inv)}
                          placeholder="—"
                        />
                      )}
                    </td>
                    <td className={styles.sheetNum}>{formatINR(cumulative)}</td>
                    {feeColumns.map((col) => {
                      const fee = inv.fees.find((f) => f.label === col.label)
                      if (!fee) {
                        return (
                          <td key={col.label} className={styles.sheetNum}>
                            {!isReadOnly ? (
                              <button className={styles.sheetAddFeeBtn} onClick={() => handleAddFeeToInvestor(inv, col)}>+ add</button>
                            ) : <span className={styles.sheetMuted}>—</span>}
                          </td>
                        )
                      }
                      const effectiveRate = getEffectiveRate(fee, dealFieldValues)
                      const amount = computeFeeAmount(fee, inv.investment_amount, dealFieldValues)
                      const editing = editingFeeCell?.investorId === inv.id && editingFeeCell?.feeId === fee.id
                      if (editing) {
                        return (
                          <td key={col.label} className={styles.sheetNum}>
                            <div className={styles.sheetFeeEdit}>
                              <button
                                className={styles.feeToggle}
                                title={fee.is_enabled ? 'Disable fee' : 'Enable fee'}
                                onMouseDown={(e) => { e.preventDefault(); setFeeTogglePending({ fee, investorId: inv.id }) }}
                              >
                                {fee.is_enabled ? '●' : '○'}
                              </button>
                              <input
                                type="number"
                                className={styles.sheetCellInput}
                                autoFocus
                                value={editingFeeCell.rate}
                                placeholder="%"
                                onChange={(e) => setEditingFeeCell((prev) => prev ? { ...prev, rate: e.target.value } : prev)}
                                onBlur={saveFeeRate}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              />
                              <button className={styles.sheetColRemove} title="Remove this fee for this investor" onMouseDown={(e) => { e.preventDefault(); handleDeleteFeeCell(inv, fee) }}>×</button>
                            </div>
                          </td>
                        )
                      }
                      return (
                        <td key={col.label} className={styles.sheetNum}>
                          <button
                            className={`${styles.sheetFeeCell} ${!fee.is_enabled ? styles.sheetFeeCellDisabled : ''}`}
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && startEditFeeRate(inv, fee)}
                          >
                            <span>{amount != null ? formatINR(amount) : '—'}</span>
                            {effectiveRate != null && <span className={styles.sheetFeeRate}>{effectiveRate}%{fee.rate == null && fee.source_field_id ? ' def' : ''}</span>}
                          </button>
                        </td>
                      )
                    })}
                    {!isReadOnly && (
                      <td className={styles.sheetActionsCol}>
                        <button className={styles.removeInvestorBtn} onClick={() => handleRemoveInvestor(inv.id)} title="Remove">✕</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.sheetSrNo} />
                <td className={styles.sheetTotalLabel}>Total</td>
                {showTabs && <td />}
                <td />
                <td className={styles.sheetNum}>{formatINR(totalCommitment)}</td>
                <td className={styles.sheetNum}>{totalShares.toLocaleString('en-IN')}</td>
                <td className={styles.sheetNum}>{formatINR(runningTotal)}</td>
                {feeColumnTotals.map((col) => (
                  <td key={col.label} className={styles.sheetNum}>{formatINR(col.total)}</td>
                ))}
                {!isReadOnly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!isReadOnly && showPicker && (
        <InvestorPickerModal
          allInvestors={allInvestors}
          alreadyAdded={visibleInvestors.map((inv) => inv.investor?.id)}
          onAdd={handleAddInvestors}
          onCreateNew={() => setShowCreateInvestor(true)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {!isReadOnly && showCreateInvestor && (
        <InvestorFormModal
          mode="create"
          internalUsers={internalUsers}
          franchisePartners={franchisePartners}
          userRole="admin"
          onClose={() => setShowCreateInvestor(false)}
          onSaved={() => {
            setShowCreateInvestor(false)
            getInvestorsForPicker().then(setAllInvestors)
          }}
        />
      )}

      {!isReadOnly && showAddFeeColumn && (
        <div className={styles.modalOverlay} onMouseDown={() => setShowAddFeeColumn(false)}>
          <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Add fee column</span>
              <button className={styles.detailClose} onClick={() => setShowAddFeeColumn(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Fee name</label>
                <input className={styles.formInput} value={newColumnLabel} onChange={(e) => setNewColumnLabel(e.target.value)} placeholder="e.g. Placement Fee" autoFocus />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Default rate (%, optional)</label>
                <input className={styles.formInput} type="number" value={newColumnRate} onChange={(e) => setNewColumnRate(e.target.value)} placeholder="%" />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.modalCancel} onClick={() => setShowAddFeeColumn(false)}>Cancel</button>
                <button className={styles.modalAccept} disabled={!newColumnLabel.trim() || isPending} onClick={handleAddFeeColumn}>Add column</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isReadOnly && feeTogglePending && (
        <FeeToggleConfirmModal
          dealName={dealTitle}
          feeLabel={feeTogglePending.fee.label}
          targetState={!feeTogglePending.fee.is_enabled}
          onConfirm={() => handleFeeToggleConfirm(feeTogglePending.fee, feeTogglePending.investorId)}
          onClose={() => setFeeTogglePending(null)}
        />
      )}
    </div>
  )
}
