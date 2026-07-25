import type { ActiveDealInvestorFee } from '@/lib/types'

// Shared fee math for active-deal investors. Lives here (not inside a component) so the
// investor spreadsheet and the deal dashboard compute "ESV earnings" identically — one
// source of truth, no drift.

type FieldValue = { field_id: string; value: string | null }

// A fee's rate is either set explicitly on the row, or inherited from a deal field the fee
// column points at (source_field_id). Returns null if neither is available.
export function getEffectiveRate(fee: ActiveDealInvestorFee, dealFieldValues: FieldValue[]): number | null {
  if (fee.rate != null) return fee.rate
  if (!fee.source_field_id) return null
  const fv = dealFieldValues.find((v) => v.field_id === fee.source_field_id)
  return fv?.value ? Number(fv.value) : null
}

// Rupee amount this fee earns on the given commitment, or null when it can't be computed
// (disabled, no commitment, or no resolvable rate).
export function computeFeeAmount(
  fee: ActiveDealInvestorFee,
  investmentAmount: number | null,
  dealFieldValues: FieldValue[],
): number | null {
  if (!fee.is_enabled || investmentAmount == null) return null
  const rate = getEffectiveRate(fee, dealFieldValues)
  if (rate == null) return null
  return (rate / 100) * investmentAmount
}
