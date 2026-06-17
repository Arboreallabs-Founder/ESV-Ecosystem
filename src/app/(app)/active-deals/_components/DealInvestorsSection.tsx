'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getDealInvestors,
  getInvestorsForPicker,
  getInternalUsers,
  getFranchisePartners,
  addInvestorToDeal,
  removeInvestorFromDeal,
  updateDealInvestor,
  upsertInvestorFee,
  toggleInvestorFee,
  deleteInvestorFee,
} from '@/app/actions/active-deals'
import type { ActiveDealInvestor, ActiveDealInvestorFee } from '@/lib/types'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import InvestorPickerModal from './InvestorPickerModal'
import FeeToggleConfirmModal from './FeeToggleConfirmModal'
import InvestorFormModal from '../../investors/_components/InvestorFormModal'
import styles from '../active-deals.module.css'

type PickerInvestor = { id: string; name: string; service_type: string; referred_by_partner_id: string | null }
type FieldValue = { field_id: string; value: string | null }

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function computeFeeAmount(fee: ActiveDealInvestorFee, investmentAmount: number | null, dealFieldValues: FieldValue[]) {
  if (!fee.is_enabled || investmentAmount == null) return null
  const effectiveRate = fee.rate ?? (() => {
    if (!fee.source_field_id) return null
    const fv = dealFieldValues.find((v) => v.field_id === fee.source_field_id)
    return fv?.value ? Number(fv.value) : null
  })()
  if (effectiveRate == null) return null
  return (effectiveRate / 100) * investmentAmount
}

function getEffectiveRate(fee: ActiveDealInvestorFee, dealFieldValues: FieldValue[]) {
  if (fee.rate != null) return fee.rate
  if (!fee.source_field_id) return null
  const fv = dealFieldValues.find((v) => v.field_id === fee.source_field_id)
  return fv?.value ? Number(fv.value) : null
}

type Props = {
  dealId: string
  dealTitle: string
}

export default function DealInvestorsSection({ dealId, dealTitle }: Props) {
  const router = useRouter()
  const [investors, setInvestors] = useState<ActiveDealInvestor[]>([])
  const [dealFieldValues, setDealFieldValues] = useState<FieldValue[]>([])
  const [allInvestors, setAllInvestors] = useState<PickerInvestor[]>([])
  const [internalUsers, setInternalUsers] = useState<Array<{ id: string; name: string }>>([])
  const [franchisePartners, setFranchisePartners] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [showCreateInvestor, setShowCreateInvestor] = useState(false)
  const [feeTogglePending, setFeeTogglePending] = useState<{ fee: ActiveDealInvestorFee; investorId: string } | null>(null)
  const [editingFee, setEditingFee] = useState<{ id: string; label: string; rate: string } | null>(null)
  const [addingFeeFor, setAddingFeeFor] = useState<string | null>(null)
  const [newFeeLabel, setNewFeeLabel] = useState('')
  const [newFeeRate, setNewFeeRate] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    Promise.all([
      getDealInvestors(dealId),
      getInvestorsForPicker(),
      getInternalUsers(),
      getFranchisePartners(),
    ]).then(([{ investors, dealFieldValues }, all, users, partners]) => {
      setInvestors(investors)
      setDealFieldValues(dealFieldValues)
      setAllInvestors(all)
      setInternalUsers(users)
      setFranchisePartners(partners)
      setLoading(false)
    })
  }, [dealId])

  function mutateInvestor(id: string, updater: (inv: ActiveDealInvestor) => ActiveDealInvestor) {
    setInvestors((prev) => prev.map((inv) => inv.id === id ? updater(inv) : inv))
  }

  function mutateFee(investorId: string, feeId: string, updater: (f: ActiveDealInvestorFee) => ActiveDealInvestorFee) {
    mutateInvestor(investorId, (inv) => ({ ...inv, fees: inv.fees.map((f) => f.id === feeId ? updater(f) : f) }))
  }

  function handleAddInvestor(investorId: string) {
    startTransition(async () => {
      try {
        const newInv = await addInvestorToDeal(dealId, investorId)
        setInvestors((prev) => [...prev, newInv])
      } catch (err) { alert(String(err)) }
    })
  }

  function handleRemoveInvestor(activeDealInvestorId: string) {
    startTransition(async () => {
      try {
        await removeInvestorFromDeal(activeDealInvestorId)
        setInvestors((prev) => prev.filter((inv) => inv.id !== activeDealInvestorId))
      } catch (err) { alert(String(err)) }
    })
  }

  function handleToggleInvesting(inv: ActiveDealInvestor) {
    const next = !inv.is_investing
    mutateInvestor(inv.id, (i) => ({ ...i, is_investing: next }))
    startTransition(async () => {
      try { await updateDealInvestor(inv.id, { is_investing: next }) }
      catch (err) { mutateInvestor(inv.id, (i) => ({ ...i, is_investing: !next })); alert(String(err)) }
    })
  }

  function handleAmountChange(inv: ActiveDealInvestor, raw: string) {
    const num = raw === '' ? null : Number(raw)
    mutateInvestor(inv.id, (i) => ({ ...i, investment_amount: isNaN(num as number) ? i.investment_amount : num }))
  }

  function handleAmountBlur(inv: ActiveDealInvestor) {
    startTransition(async () => {
      try { await updateDealInvestor(inv.id, { investment_amount: inv.investment_amount }) }
      catch (err) { alert(String(err)) }
    })
  }

  function handleFeeToggleClick(fee: ActiveDealInvestorFee, investorId: string) {
    setFeeTogglePending({ fee, investorId })
  }

  function handleFeeToggleConfirm(fee: ActiveDealInvestorFee, investorId: string) {
    const next = !fee.is_enabled
    mutateFee(investorId, fee.id, (f) => ({ ...f, is_enabled: next }))
    startTransition(async () => {
      try { await toggleInvestorFee(fee.id, next) }
      catch (err) { mutateFee(investorId, fee.id, (f) => ({ ...f, is_enabled: !next })); alert(String(err)) }
    })
  }

  function handleFeeEdit(fee: ActiveDealInvestorFee) {
    setEditingFee({ id: fee.id, label: fee.label, rate: fee.rate?.toString() ?? '' })
  }

  function handleFeeSave(investorId: string) {
    if (!editingFee) return
    const rate = editingFee.rate === '' ? null : Number(editingFee.rate)
    const label = editingFee.label.trim()
    if (!label) return
    mutateFee(investorId, editingFee.id, (f) => ({ ...f, label, rate }))
    const captured = editingFee
    setEditingFee(null)
    startTransition(async () => {
      try { await upsertInvestorFee(investorId, { id: captured.id, label, rate, source_field_id: null }) }
      catch (err) { alert(String(err)) }
    })
  }

  function handleFeeDelete(investorId: string, feeId: string) {
    mutateInvestor(investorId, (inv) => ({ ...inv, fees: inv.fees.filter((f) => f.id !== feeId) }))
    startTransition(async () => {
      try { await deleteInvestorFee(feeId) }
      catch (err) { alert(String(err)) }
    })
  }

  function handleAddFee(inv: ActiveDealInvestor) {
    const label = newFeeLabel.trim()
    if (!label) return
    const rate = newFeeRate === '' ? null : Number(newFeeRate)
    startTransition(async () => {
      try {
        const newId = await upsertInvestorFee(inv.id, { label, rate, source_field_id: null })
        const newFee: ActiveDealInvestorFee = { id: newId!, label, rate, source_field_id: null, is_enabled: true }
        mutateInvestor(inv.id, (i) => ({ ...i, fees: [...i.fees, newFee] }))
        setAddingFeeFor(null)
        setNewFeeLabel('')
        setNewFeeRate('')
      } catch (err) { alert(String(err)) }
    })
  }

  // Totals
  const totalInvestment = investors
    .filter((inv) => inv.is_investing && inv.investment_amount != null)
    .reduce((sum, inv) => sum + (inv.investment_amount ?? 0), 0)

  const totalEarnings = investors.reduce((sum, inv) => {
    return sum + inv.fees.reduce((feeSum, fee) => {
      const amt = computeFeeAmount(fee, inv.investment_amount, dealFieldValues)
      return feeSum + (amt ?? 0)
    }, 0)
  }, 0)

  if (loading) return (
    <div className={styles.detailSection}>
      <div className={styles.detailSectionTitle}>Investors</div>
      <div className={styles.detailLoading}>Loading…</div>
    </div>
  )

  return (
    <>
      <div className={styles.detailSection}>
        <div className={styles.investorsSectionHeader}>
          <div className={styles.detailSectionTitle}>
            Investors {investors.length > 0 && <span className={styles.tabCount}>{investors.length}</span>}
          </div>
          <button className={styles.addInvestorBtn} onClick={() => setShowPicker(true)}>+ Add Investor</button>
        </div>

        {investors.length === 0 ? (
          <div className={styles.detailEmpty}>No investors added yet.</div>
        ) : (
          <div className={styles.investorTable}>
            {/* Table header */}
            <div className={styles.investorTableHead}>
              <span>Investor</span>
              <span>Investing</span>
              <span>Amount (₹)</span>
              <span />
            </div>

            {investors.map((inv) => (
              <div key={inv.id} className={styles.investorGroup}>
                {/* Main investor row */}
                <div className={styles.investorTableRow}>
                  <div className={styles.iColName}>
                    <span className={styles.investorName}>{inv.investor?.name}</span>
                    <div className={styles.investorBadges}>
                      <span className={styles.investorTypeBadge}>
                        {(SERVICE_TYPE_LABELS as Record<string, string>)[inv.investor?.service_type] ?? inv.investor?.service_type}
                      </span>
                      {inv.is_referral && <span className={styles.referralChip}>Referral</span>}
                    </div>
                  </div>
                  <div className={styles.iColInvesting}>
                    <button
                      className={`${styles.investingToggle} ${inv.is_investing ? styles.investingOn : ''}`}
                      onClick={() => handleToggleInvesting(inv)}
                    >
                      {inv.is_investing ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div className={styles.iColAmount}>
                    <input
                      type="number"
                      className={styles.investorAmountInput}
                      value={inv.investment_amount ?? ''}
                      onChange={(e) => handleAmountChange(inv, e.target.value)}
                      onBlur={() => handleAmountBlur(inv)}
                      placeholder="—"
                    />
                  </div>
                  <div className={styles.iColAction}>
                    <button className={styles.removeInvestorBtn} onClick={() => handleRemoveInvestor(inv.id)} title="Remove">✕</button>
                  </div>
                </div>

                {/* Fee sub-rows */}
                <div className={styles.feeBlock}>
                  {inv.fees.map((fee) => {
                    const effectiveRate = getEffectiveRate(fee, dealFieldValues)
                    const calculatedAmount = computeFeeAmount(fee, inv.investment_amount, dealFieldValues)
                    const isEditing = editingFee?.id === fee.id

                    if (isEditing) {
                      return (
                        <div key={fee.id} className={styles.feeRowEdit}>
                          <input
                            className={styles.feeEditInput}
                            value={editingFee.label}
                            onChange={(e) => setEditingFee((prev) => prev ? { ...prev, label: e.target.value } : prev)}
                            placeholder="Fee label"
                          />
                          <input
                            className={`${styles.feeEditInput} ${styles.feeEditInputRate}`}
                            type="number"
                            value={editingFee.rate}
                            onChange={(e) => setEditingFee((prev) => prev ? { ...prev, rate: e.target.value } : prev)}
                            placeholder="%"
                          />
                          <button className={styles.feeSaveBtn} onClick={() => handleFeeSave(inv.id)}>Save</button>
                          <button className={styles.feeCancelBtn} onClick={() => setEditingFee(null)}>Cancel</button>
                        </div>
                      )
                    }

                    return (
                      <div key={fee.id} className={`${styles.feeRow} ${!fee.is_enabled ? styles.feeDisabled : ''}`}>
                        <span className={styles.feeToggleCell}>
                          {fee.source_field_id ? (
                            <button
                              className={styles.feeToggle}
                              title={fee.is_enabled ? 'Disable fee' : 'Enable fee'}
                              onClick={() => handleFeeToggleClick(fee, inv.id)}
                            >
                              {fee.is_enabled ? '●' : '○'}
                            </button>
                          ) : <span className={styles.feeToggleSpacer} />}
                        </span>
                        <span className={styles.feeLabel}>{fee.label}</span>
                        <span className={styles.feeRate}>
                          {effectiveRate != null ? (
                            <>{effectiveRate}%{fee.rate == null && fee.source_field_id && <span className={styles.feeDefault}> def</span>}</>
                          ) : '—'}
                        </span>
                        <span className={styles.feeEarning}>
                          {calculatedAmount != null ? formatINR(calculatedAmount) : '—'}
                        </span>
                        <span className={styles.feeActions}>
                          <button className={styles.feeActionBtn} onClick={() => handleFeeEdit(fee)}>Edit</button>
                          {!fee.source_field_id && (
                            <button className={styles.feeActionBtn} onClick={() => handleFeeDelete(inv.id, fee.id)}>×</button>
                          )}
                        </span>
                      </div>
                    )
                  })}

                  {/* Add custom fee */}
                  {addingFeeFor === inv.id ? (
                    <div className={styles.feeRowEdit}>
                      <input
                        className={styles.feeEditInput}
                        value={newFeeLabel}
                        onChange={(e) => setNewFeeLabel(e.target.value)}
                        placeholder="Fee label"
                        autoFocus
                      />
                      <input
                        className={`${styles.feeEditInput} ${styles.feeEditInputRate}`}
                        type="number"
                        value={newFeeRate}
                        onChange={(e) => setNewFeeRate(e.target.value)}
                        placeholder="%"
                      />
                      <button className={styles.feeSaveBtn} onClick={() => handleAddFee(inv)}>Add</button>
                      <button className={styles.feeCancelBtn} onClick={() => { setAddingFeeFor(null); setNewFeeLabel(''); setNewFeeRate('') }}>Cancel</button>
                    </div>
                  ) : (
                    <button className={styles.addFeeBtn} onClick={() => setAddingFeeFor(inv.id)}>+ Add Fee</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        {investors.length > 0 && (
          <div className={styles.investorsTotalsRow}>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Total Investment</span>
              <span className={styles.totalsValue}>{formatINR(totalInvestment)}</span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Total Earnings</span>
              <span className={styles.totalsValue}>{formatINR(totalEarnings)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showPicker && (
        <InvestorPickerModal
          allInvestors={allInvestors}
          alreadyAdded={investors.map((inv) => inv.investor?.id)}
          onSelect={handleAddInvestor}
          onCreateNew={() => setShowCreateInvestor(true)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showCreateInvestor && (
        <InvestorFormModal
          mode="create"
          internalUsers={internalUsers}
          franchisePartners={franchisePartners}
          userRole="admin"
          onClose={() => setShowCreateInvestor(false)}
          onSaved={() => {
            setShowCreateInvestor(false)
            getInvestorsForPicker().then(setAllInvestors)
            router.refresh()
          }}
        />
      )}

      {feeTogglePending && (
        <FeeToggleConfirmModal
          dealName={dealTitle}
          feeLabel={feeTogglePending.fee.label}
          targetState={!feeTogglePending.fee.is_enabled}
          onConfirm={() => handleFeeToggleConfirm(feeTogglePending.fee, feeTogglePending.investorId)}
          onClose={() => setFeeTogglePending(null)}
        />
      )}
    </>
  )
}
