'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import { setActiveDealRaiseShape } from '@/app/actions/active-deals'
import { openAmount, raiseBreakdown } from '@/lib/referral-tree'
import styles from '../active-deals.module.css'

/**
 * The shape of the round: the whole raise, what an outside party already filled, what we have
 * committed, what is still open, and the smallest cheque.
 *
 * One component for every role. The minimum ticket and the external raise are visible to everyone
 * including partners by instruction — they are the two facts someone needs before putting the deal
 * in front of an investor, and a partner quoting a minimum we have since changed is worse than them
 * knowing the number. Only the editing is gated.
 *
 * "Open" is derived here and never stored: a stored remaining disagrees with the investor rows the
 * moment one is edited, and the disagreement is invisible.
 */
export default function RoundShape({
  dealId,
  totalRaise,
  externalRaised,
  minTicket,
  committed,
  canEdit,
}: {
  dealId: string
  totalRaise: number | null
  externalRaised: number | null
  minTicket: number | null
  /** Committed through ESV. Already the partner-safe aggregate where the viewer is a partner. */
  committed: number
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [total, setTotal] = useState(totalRaise?.toString() ?? '')
  const [external, setExternal] = useState(externalRaised?.toString() ?? '')
  const [minimum, setMinimum] = useState(minTicket?.toString() ?? '')

  const open = openAmount(totalRaise, externalRaised, committed)
  const bars = raiseBreakdown(totalRaise, externalRaised, committed)
  const nothingSet = totalRaise == null && externalRaised == null && minTicket == null

  function save() {
    const parse = (v: string) => {
      const t = v.trim()
      if (t === '') return null
      const n = Number(t.replace(/[,\s₹]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    startTransition(async () => {
      try {
        await setActiveDealRaiseShape(dealId, {
          total_raise: parse(total),
          external_raised: parse(external),
          min_ticket: parse(minimum),
        })
        setEditing(false)
        router.refresh()
      } catch (err) { alertError(err) }
    })
  }

  if (nothingSet && !canEdit) return null

  return (
    <div className={styles.dashCard}>
      <div className={styles.detailSectionHead}>
        <div className={styles.detailSectionTitle}>The round</div>
        {canEdit && !editing && (
          <button type="button" className={styles.inlineLink} onClick={() => setEditing(true)}>
            {nothingSet ? 'Add the numbers' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <div className={styles.roundEdit}>
          <div className={styles.roundField}>
            <label className={styles.statLabel} htmlFor={`total-${dealId}`}>Total being raised (₹)</label>
            <input id={`total-${dealId}`} className={styles.roundInput} inputMode="numeric"
                   value={total} onChange={(e) => setTotal(e.target.value)} placeholder="e.g. 1000000000" />
          </div>
          <div className={styles.roundField}>
            <label className={styles.statLabel} htmlFor={`ext-${dealId}`}>Raised outside ESV (₹)</label>
            <input id={`ext-${dealId}`} className={styles.roundInput} inputMode="numeric"
                   value={external} onChange={(e) => setExternal(e.target.value)} placeholder="e.g. 700000000" />
          </div>
          <div className={styles.roundField}>
            <label className={styles.statLabel} htmlFor={`min-${dealId}`}>Minimum ticket (₹)</label>
            <input id={`min-${dealId}`} className={styles.roundInput} inputMode="numeric"
                   value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="e.g. 10000000" />
          </div>
          <div className={styles.roundActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setEditing(false)} disabled={pending}>Cancel</button>
            <button type="button" className={styles.primaryBtn} onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className={styles.roundHint}>
            Leave a box empty to clear it. Amounts in rupees — ₹1 Cr is 10000000. The minimum ticket
            and the external raise are shown to partners.
          </p>
        </div>
      ) : (
        <>
          {bars && (
            <div className={styles.roundBarWrap}>
              <div className={styles.roundBar}>
                <div className={styles.roundSegExternal} style={{ width: `${bars.externalPct}%` }}
                     title={`Raised outside ESV: ${inr(externalRaised ?? 0)}`} />
                <div className={styles.roundSegCommitted} style={{ width: `${bars.committedPct}%` }}
                     title={`Committed through ESV: ${inr(committed)}`} />
              </div>
              <div className={styles.roundLegend}>
                <LegendDot className={styles.dotExternal} label="Outside ESV" />
                <LegendDot className={styles.dotCommitted} label="Through ESV" />
                <LegendDot className={styles.dotOpen} label="Open" />
              </div>
            </div>
          )}

          <div className={styles.statRow}>
            <Figure label="Total raise" value={totalRaise} hero />
            <Figure label="Raised outside ESV" value={externalRaised} />
            <Figure label="Still open" value={open} />
            <Figure label="Minimum ticket" value={minTicket} />
          </div>

          {totalRaise == null && (externalRaised != null || minTicket != null) && (
            <p className={styles.roundHint}>
              No round total recorded, so what is still open cannot be worked out.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className={styles.roundLegendItem}>
      <span className={`${styles.roundDot} ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function Figure({ label, value, hero }: { label: string; value: number | null; hero?: boolean }) {
  return (
    <div className={styles.statBlock}>
      <span className={styles.statLabel}>{label}</span>
      <span className={hero ? styles.statValueHero : styles.statValue}>
        {value == null ? '—' : inr(value)}
      </span>
    </div>
  )
}

/** Crore and lakh, the units these numbers are spoken in. */
function inr(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
