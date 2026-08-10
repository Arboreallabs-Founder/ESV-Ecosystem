'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import Link from 'next/link'
import { setPartnerDealShare } from '@/app/actions/partners'
import type { PartnerDealEarning, PartnerShareBase } from '@/lib/types'
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
}: {
  partnerId: string
  partnerName: string
  standardSplit: number
  deals: PartnerDealEarning[]
}) {
  const [rows, setRows] = useState<Row[]>(deals.map((d) => ({ ...d, splitInput: String(d.split_pct) })))
  const [, startTransition] = useTransition()

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

  const totalOrg = rows.reduce((s, r) => s + r.org_total_earning, 0)
  const totalReferred = rows.reduce((s, r) => s + r.referred_earning, 0)
  const totalShare = rows.reduce((s, r) => s + r.share_amount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/admin/partners" className={styles.emailLink} style={{ fontSize: '0.8125rem' }}>← Partners</Link>
          <div className={styles.pageTitle} style={{ marginTop: '0.35rem' }}>{partnerName} — Deals & Earnings</div>
          <div className={styles.pageSub}>
            Standard Fee Split {standardSplit}% · {rows.length} deal{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Org Total Earning', value: totalOrg },
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
                <th>Org Total Earning</th>
                <th>Referred Earning</th>
                <th>Share From</th>
                <th>Split %</th>
                <th>Partner Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.active_deal_id}>
                  <td><div className={styles.name}>{r.deal_title || 'Untitled'}</div></td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      {r.is_sourced ? 'Sourced' : 'Referral'}
                    </span>
                  </td>
                  <td>{formatINR(r.org_total_earning)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
