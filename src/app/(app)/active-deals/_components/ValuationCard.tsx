'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import { setActiveDealValuation } from '@/app/actions/active-deals'
import { VALUATION_BASIS_LABELS } from '@/lib/types'
import type { ValuationBasis } from '@/lib/types'
import styles from '../active-deals.module.css'

/**
 * What the company was worth when the money went in.
 *
 * Its own card rather than a line on the round, because it answers a different question: the round
 * is how much is being raised, this is what that buys. Both are read by everyone including
 * partners — a valuation is on every deck, and a partner quoting a stale one is worse than them
 * knowing it. Only editing is gated.
 *
 * ─── Pre and post ──────────────────────────────────────────────────────────
 * "103 Cr" means two different things depending on whether the round is inside it, and on a 16 Cr
 * raise that is 16 Cr of company. So the basis is shown next to the figure, and the implied stake
 * for this round is derived ONLY when the basis is recorded. A percentage computed from a guess
 * reads exactly like one computed from a fact, which is why there isn't a default.
 */
export default function ValuationCard({
  dealId,
  valuation,
  valuationBasis,
  totalRaise,
  canEdit,
}: {
  dealId: string
  valuation: number | null
  valuationBasis: ValuationBasis | null
  /** The round, for the implied stake. Null leaves the stake unshown rather than guessed. */
  totalRaise: number | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(valuation?.toString() ?? '')
  const [basis, setBasis] = useState<'' | ValuationBasis>(valuationBasis ?? '')

  const stake = impliedStake(valuation, valuationBasis, totalRaise)

  if (valuation == null && !canEdit) return null

  function save() {
    const t = amount.trim()
    const parsed = t === '' ? null : Number(t.replace(/[,\s₹]/g, ''))
    startTransition(async () => {
      try {
        await setActiveDealValuation(dealId, {
          valuation: parsed != null && Number.isFinite(parsed) ? parsed : null,
          valuation_basis: basis === '' ? null : basis,
        })
        setEditing(false)
        router.refresh()
      } catch (err) { alertError(err) }
    })
  }

  return (
    <div className={styles.dashCard}>
      <div className={styles.detailSectionHead}>
        <div className={styles.detailSectionTitle}>Valuation</div>
        {canEdit && !editing && (
          <button type="button" className={styles.inlineLink} onClick={() => setEditing(true)}>
            {valuation == null ? 'Add it' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <div className={styles.roundEdit}>
          <div className={styles.roundField}>
            <label className={styles.statLabel} htmlFor={`val-${dealId}`}>Valuation (₹)</label>
            <input id={`val-${dealId}`} className={styles.roundInput} inputMode="numeric"
                   value={amount} onChange={(e) => setAmount(e.target.value)}
                   placeholder="e.g. 1030000000" />
          </div>
          <div className={styles.roundField}>
            <label className={styles.statLabel} htmlFor={`basis-${dealId}`}>Basis</label>
            <select id={`basis-${dealId}`} className={styles.roundInput}
                    value={basis} onChange={(e) => setBasis(e.target.value as '' | ValuationBasis)}>
              <option value="">Not recorded</option>
              <option value="pre">Pre-money</option>
              <option value="post">Post-money</option>
            </select>
          </div>
          <div className={styles.roundActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setEditing(false)} disabled={pending}>Cancel</button>
            <button type="button" className={styles.primaryBtn} onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className={styles.roundHint}>
            Rupees — ₹103 Cr is 1030000000. Leave the basis unset if nobody recorded whether the
            round sits inside the number; the stake is only worked out when it is known.
          </p>
        </div>
      ) : valuation == null ? (
        <p className={styles.roundHint}>No valuation recorded.</p>
      ) : (
        <>
          <div className={styles.statRow}>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>Valuation</span>
              <span className={styles.statValueHero}>{inr(valuation)}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>Basis</span>
              <span className={styles.statValue}>
                {valuationBasis ? VALUATION_BASIS_LABELS[valuationBasis] : 'Not recorded'}
              </span>
            </div>
            {stake != null && (
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>This round buys</span>
                <span className={styles.statValue}>{stake.toFixed(2)}%</span>
              </div>
            )}
          </div>

          {valuationBasis == null && totalRaise != null && (
            <p className={styles.roundHint}>
              Whether this is pre- or post-money was never recorded, so what the round buys is not
              worked out — on a round this size the two answers differ by a real amount.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * What share of the company this round buys.
 *
 * Pre-money: the round is added to the valuation to get the post-money denominator. Post-money: the
 * valuation already includes it. Null whenever the basis or the round is unknown — that is the
 * whole point of the basis column.
 */
function impliedStake(
  valuation: number | null,
  basis: ValuationBasis | null,
  totalRaise: number | null,
): number | null {
  if (valuation == null || basis == null || totalRaise == null || totalRaise <= 0) return null
  const post = basis === 'pre' ? valuation + totalRaise : valuation
  if (post <= 0) return null
  return Math.min(100, (totalRaise / post) * 100)
}

/** Crore and lakh, the units these are spoken in. */
function inr(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
