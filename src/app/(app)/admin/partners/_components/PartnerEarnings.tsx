'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import Link from 'next/link'
import { setPartnerDealExcluded, setPartnerDealShare } from '@/app/actions/partners'
import { PARTNER_TIER_LABELS } from '@/lib/types'
import type {
  PartnerDealEarning, PartnerShareBase, PartnerReferralTreeNode, PartnerTier,
  PartnerLedgerEntry, PartnerLedgerSummary,
} from '@/lib/types'
import PartnerReferralTree from './PartnerReferralTree'
import PartnerEarningsView from '../../../earnings/_components/PartnerEarningsView'
import PartnerLedger from '../../../earnings/_components/PartnerLedger'
import styles from '../../admin.module.css'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function computeShare(base: PartnerShareBase, splitPct: number, orgTotal: number, referred: number) {
  return (splitPct / 100) * (base === 'total' ? orgTotal : referred)
}

type Row = PartnerDealEarning & { splitInput: string }

export default function PartnerEarnings({
  partnerId,
  partnerName,
  standardSplit,
  deals,
  tier,
  tree,
  ledgerEntries,
  ledgerSummary,
  canEditLedger = false,
}: {
  partnerId: string
  partnerName: string
  standardSplit: number
  deals: PartnerDealEarning[]
  tier: PartnerTier
  tree: PartnerReferralTreeNode[]
  ledgerEntries: PartnerLedgerEntry[]
  ledgerSummary: PartnerLedgerSummary
  /** Founder/admin. Associates read the account without being able to decide it. */
  canEditLedger?: boolean
}) {
  const [rows, setRows] = useState<Row[]>(deals.map((d) => ({ ...d, splitInput: String(d.split_pct) })))
  const [, startTransition] = useTransition()
  // "What does this partner actually see?" — asked whenever a partner queries their number.
  const [partnerView, setPartnerView] = useState(false)
  const [excludePending, startExclude] = useTransition()

  function toggleExcluded(r: Row) {
    const next = !r.is_excluded
    setRows((prev) => prev.map((x) => x.active_deal_id === r.active_deal_id
      ? { ...x, is_excluded: next, share_amount: next ? 0 : computeShare(x.base_type, x.split_pct, x.org_total_earning, x.referred_earning) }
      : x))
    startExclude(async () => {
      try {
        await setPartnerDealExcluded(r.active_deal_id, partnerId, next)
      } catch (err) {
        // Put the row back. A deal that still reads "Excluded" after a refused write is a claim
        // that a partner is not owed something they are.
        setRows((prev) => prev.map((x) => x.active_deal_id === r.active_deal_id ? r : x))
        alertError(err)
      }
    })
  }

  function persist(dealId: string, base: PartnerShareBase, splitPct: number | null) {
    startTransition(async () => {
      try { await setPartnerDealShare(dealId, partnerId, base, splitPct) }
      catch (err) { alertError(err) }
    })
  }

  function handleBaseChange(dealId: string, base: PartnerShareBase) {
    setRows((prev) => prev.map((r) => {
      if (r.active_deal_id !== dealId) return r
      const share = computeShare(base, r.split_pct, r.org_total_earning, r.referred_earning)
      return { ...r, base_type: base, share_amount: share }
    }))
    const row = rows.find((r) => r.active_deal_id === dealId)
    const override = row && row.splitInput.trim() !== '' && Number(row.splitInput) !== standardSplit ? Number(row.splitInput) : null
    persist(dealId, base, override)
  }

  function handleSplitBlur(dealId: string) {
    setRows((prev) => prev.map((r) => {
      if (r.active_deal_id !== dealId) return r
      const raw = r.splitInput.trim()
      const effective = raw === '' ? standardSplit : Number(raw)
      const safe = isNaN(effective) ? standardSplit : effective
      const share = computeShare(r.base_type, safe, r.org_total_earning, r.referred_earning)
      return { ...r, split_pct: safe, splitInput: raw === '' ? '' : String(safe), share_amount: share }
    }))
    const row = rows.find((r) => r.active_deal_id === dealId)
    if (!row) return
    const raw = row.splitInput.trim()
    const override = raw === '' ? null : (Number(raw) === standardSplit ? null : Number(raw))
    persist(dealId, row.base_type, isNaN(Number(raw)) && raw !== '' ? null : override)
  }

  // Excluded deals are out of every total, not just the share. share_amount is already zeroed by
  // the function, but org total and referred earning are not, and summing those would describe a
  // deal this partner is explicitly not part of.
  const counted = rows.filter((r) => !r.is_excluded)
  const totalReferred = counted.reduce((s, r) => s + r.referred_earning, 0)
  const totalShare = counted.reduce((s, r) => s + r.share_amount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/admin/partners" className={styles.emailLink} style={{ fontSize: '0.8125rem' }}>← Partners</Link>
          <div className={styles.pageTitle} style={{ marginTop: '0.35rem' }}>{partnerName} — Deals & Earnings</div>
          <div className={styles.pageSub}>
            {PARTNER_TIER_LABELS[tier]} · Standard Fee Split {standardSplit}% · {rows.length} deal{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          type="button"
          className={styles.viewAsBtn}
          onClick={() => setPartnerView((v) => !v)}
          aria-pressed={partnerView}
        >
          {partnerView ? 'Back to the full picture' : 'See their view'}
        </button>
      </div>

      {partnerView ? (
        <>
          <p className={styles.viewAsNote}>
            Exactly what {partnerName} sees on their own My Earnings page — same component, same
            figures. They get their own share and nothing else: no org totals, no base selector, no
            other partners, no investor rows.
          </p>
          <PartnerEarningsView
            partnerName={partnerName}
            deals={rows.map((r) => ({
              active_deal_id: r.active_deal_id,
              deal_title: r.deal_title,
              accepted_at: r.accepted_at,
              split_pct: r.split_pct,
              share_amount: r.share_amount,
            }))}
            tree={tree}
            voice="third"
          />
        </>
      ) : (
      <>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Earning via Their Investors', value: totalReferred },
          { label: 'Partner Share', value: totalShare, accent: true },
        ].map((s) => (
          <div key={s.label} style={{
            flex: '1 1 200px',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.125rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '0.35rem', color: s.accent ? 'var(--color-primary)' : 'var(--color-text)' }}>
              {formatINR(s.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <div className={styles.pageTitle} style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Referral tree</div>
        <PartnerReferralTree partnerName={partnerName} rows={tree} linkInvestors />
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          No deals yet. This partner appears here once a deal is sourced via their link or one of their
          referred investors is added to an accepted deal.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Tie</th>
                <th>Referred Earning</th>
                <th>Share From</th>
                <th>Split %</th>
                <th>Partner Share</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.active_deal_id} className={r.is_excluded ? styles.excludedRow : undefined}>
                  <td>
                    <div className={styles.name}>{r.deal_title || 'Untitled'}</div>
                    {r.is_excluded && <span className={styles.excludedTag}>Excluded</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      {r.is_sourced ? 'Sourced' : 'Referral'}
                    </span>
                  </td>
                  <td>{formatINR(r.referred_earning)}</td>
                  <td>
                    <select
                      className={styles.select}
                      style={{ minWidth: '150px' }}
                      value={r.base_type}
                      onChange={(e) => handleBaseChange(r.active_deal_id, e.target.value as PartnerShareBase)}
                    >
                      <option value="referred">Referred earning</option>
                      <option value="total">Total earning</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      style={{ width: '90px' }}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={r.splitInput}
                      placeholder={String(standardSplit)}
                      onChange={(e) => setRows((prev) => prev.map((x) => x.active_deal_id === r.active_deal_id ? { ...x, splitInput: e.target.value } : x))}
                      onBlur={() => handleSplitBlur(r.active_deal_id)}
                    />
                  </td>
                  <td><span className={styles.feeSplit} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatINR(r.share_amount)}</span></td>
                  <td>
                    <button
                      type="button"
                      className={styles.excludeBtn}
                      disabled={excludePending}
                      title={r.is_excluded
                        ? 'Put this deal back on their earnings.'
                        : 'Take this deal off their earnings. It disappears from their own page and drops out of every total.'}
                      onClick={() => toggleExcluded(r)}
                    >
                      {r.is_excluded ? 'Include' : 'Exclude'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PartnerLedger
        partnerId={partnerId}
        partnerName={partnerName}
        entries={ledgerEntries}
        summary={ledgerSummary}
        earned={totalShare}
        canEdit={canEditLedger}
        voice="third"
      />
      </>
      )}
    </div>
  )
}
