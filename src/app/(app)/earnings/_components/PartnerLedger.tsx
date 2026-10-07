'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import { addPartnerLedgerEntry, deletePartnerLedgerEntry } from '@/app/actions/partners'
import {
  LEDGER_ENTRY_TYPES, LEDGER_ENTRY_LABELS, LEDGER_ENTRY_HINTS, LEDGER_ENTRY_DIRECTION,
} from '@/lib/types'
import type {
  PartnerLedgerEntry, PartnerLedgerEntryType, PartnerLedgerSummary,
} from '@/lib/types'
import styles from '../earnings.module.css'

/**
 * A partner's account with us: the buy-in, what has been paid against it, and what we have paid out.
 *
 * One component for both sides, like the earnings view — the partner reads it on /earnings, an
 * admin reads and writes it on /admin/partners/[id]. A second copy would be a second answer to
 * "what does Robin's account say", and the two would stop matching the first time either was
 * edited.
 *
 * Every balance is summed from the lines by the database, never stored, so the total under the
 * table and the table itself cannot disagree.
 */
export default function PartnerLedger({
  partnerId,
  partnerName,
  entries,
  summary,
  earned,
  canEdit = false,
  voice = 'first',
}: {
  partnerId: string
  partnerName: string
  entries: PartnerLedgerEntry[]
  summary: PartnerLedgerSummary
  /** Total earned across deals, from get_partner_earnings. What settles against it lives here. */
  earned: number
  canEdit?: boolean
  voice?: 'first' | 'third'
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [pending, start] = useTransition()

  const [entryType, setEntryType] = useState<PartnerLedgerEntryType>('payment')
  const [amount, setAmount] = useState('')
  const [gst, setGst] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const they = voice === 'first' ? 'Your' : 'Their'
  // Earned, less what has already been settled by a payout or an adjustment.
  const owedToPartner = earned - summary.earnings_settled

  function submit() {
    const parsed = Number(amount.replace(/[,\s₹]/g, ''))
    start(async () => {
      try {
        const gstParsed = gst.trim() === '' ? null : Number(gst.replace(/[,\s₹]/g, ''))
        await addPartnerLedgerEntry({
          partnerId,
          entryType,
          amount: parsed,
          gstAmount: gstParsed,
          entryDate,
          reference: reference || null,
          note: note || null,
        })
        setAdding(false); setAmount(''); setGst(''); setReference(''); setNote('')
        router.refresh()
      } catch (err) { alertError(err) }
    })
  }

  function remove(e: PartnerLedgerEntry) {
    if (!confirm(`Delete this ${LEDGER_ENTRY_LABELS[e.entry_type].toLowerCase()} of ${inr(e.amount)}?`)) return
    start(async () => {
      try { await deletePartnerLedgerEntry(e.id, partnerId); router.refresh() }
      catch (err) { alertError(err) }
    })
  }

  return (
    <section className={styles.ledgerSection}>
      <div className={styles.ledgerHead}>
        <h2 className={styles.sectionTitle}>{they} account</h2>
        {canEdit && !adding && (
          <button type="button" className={styles.ledgerAddBtn} onClick={() => setAdding(true)}>
            + Add an entry
          </button>
        )}
      </div>

      <div className={styles.ledgerBalances}>
        <Balance
          label="Buy-in outstanding"
          value={summary.buy_in_outstanding}
          hint={summary.buy_in_outstanding < 0 ? 'Overpaid — this is owed back.' : undefined}
          accent
        />
        <Balance label="Buy-in charged" value={summary.buy_in_total} />
        <Balance label="Paid against it" value={summary.paid_total + summary.adjusted_total} />
        <Balance
          label="Earnings still owed"
          value={owedToPartner}
          hint={`${inr(earned)} earned, ${inr(summary.earnings_settled)} settled`}
        />
        {summary.payout_gst_total > 0 && (
          <Balance
            label="Paid out incl GST"
            value={summary.payout_with_gst}
            hint={`${inr(summary.payout_total)} + ${inr(summary.payout_gst_total)} GST — cash, not a balance`}
          />
        )}
      </div>

      {adding && canEdit && (
        <div className={styles.ledgerForm}>
          <div className={styles.ledgerField}>
            <label className={styles.ledgerLabel} htmlFor="le-type">Entry</label>
            <select id="le-type" className={styles.ledgerInput} value={entryType}
                    onChange={(e) => setEntryType(e.target.value as PartnerLedgerEntryType)}>
              {LEDGER_ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>{LEDGER_ENTRY_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className={styles.ledgerField}>
            <label className={styles.ledgerLabel} htmlFor="le-amount">Amount (₹)</label>
            <input id="le-amount" className={styles.ledgerInput} inputMode="numeric"
                   value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500000" />
          </div>
          <div className={styles.ledgerField}>
            <label className={styles.ledgerLabel} htmlFor="le-gst">
              GST (optional)
              {/* Writes the figure, not the rate: an invoice states an amount, and rates get
                  rounded and split across CGST/SGST in ways that do not reproduce cleanly. */}
              <button
                type="button"
                className={styles.ledgerGstFill}
                onClick={() => {
                  const base = Number(amount.replace(/[,\s₹]/g, ''))
                  if (Number.isFinite(base) && base > 0) setGst(Math.round(base * 0.18).toString())
                }}
              >
                18%
              </button>
            </label>
            <input id="le-gst" className={styles.ledgerInput} inputMode="numeric"
                   value={gst} onChange={(e) => setGst(e.target.value)} placeholder="e.g. 48240" />
          </div>
          <div className={styles.ledgerField}>
            <label className={styles.ledgerLabel} htmlFor="le-date">Date</label>
            <input id="le-date" type="date" className={styles.ledgerInput}
                   value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className={styles.ledgerField}>
            <label className={styles.ledgerLabel} htmlFor="le-ref">
              Receipt / UTR{entryType === 'payout' ? '' : ' (optional)'}
            </label>
            <input id="le-ref" className={styles.ledgerInput} value={reference}
                   onChange={(e) => setReference(e.target.value)} placeholder="e.g. UTR123456789" />
          </div>
          <div className={`${styles.ledgerField} ${styles.ledgerFieldWide}`}>
            <label className={styles.ledgerLabel} htmlFor="le-note">Note (optional)</label>
            <input id="le-note" className={styles.ledgerInput} value={note}
                   onChange={(e) => setNote(e.target.value)} placeholder="What this covers" />
          </div>
          <div className={styles.ledgerFormActions}>
            <button type="button" className={styles.ledgerCancel} onClick={() => setAdding(false)} disabled={pending}>Cancel</button>
            <button type="button" className={styles.ledgerSave} onClick={submit} disabled={pending}>
              {pending ? 'Saving…' : 'Add entry'}
            </button>
          </div>
          <p className={styles.ledgerHint}>{LEDGER_ENTRY_HINTS[entryType]}
            {entryType === 'payout' && ' A receipt number is required — it is what makes this reconcilable against the bank.'}
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <div className={styles.empty}>
          Nothing on {voice === 'first' ? 'your' : 'this'} account yet.
          {canEdit && ' Start with the buy-in.'}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Reference</th>
                <th className={styles.ledgerNum}>Amount</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className={styles.muted}>{formatDate(e.entry_date)}</td>
                  <td>
                    <span className={styles.dealName}>{LEDGER_ENTRY_LABELS[e.entry_type]}</span>
                    {e.deal?.title && <span className={styles.ledgerDeal}> · {e.deal.title}</span>}
                    {e.note && <div className={styles.ledgerNote}>{e.note}</div>}
                  </td>
                  <td className={styles.muted}>{e.reference || '—'}</td>
                  <td className={styles.ledgerNum}>
                    <span className={LEDGER_ENTRY_DIRECTION[e.entry_type] === 'owes' ? styles.ledgerOwes : styles.ledgerSettles}>
                      {LEDGER_ENTRY_DIRECTION[e.entry_type] === 'owes' ? '+' : '−'}{inr(e.amount)}
                    </span>
                    {e.gst_amount != null && e.gst_amount > 0 && (
                      <div className={styles.ledgerGstLine}>
                        + {inr(e.gst_amount)} GST · {inr(e.amount + e.gst_amount)} moved
                      </div>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button type="button" className={styles.ledgerDelete} disabled={pending}
                              onClick={() => remove(e)} title="Delete this entry">×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.ledgerFoot}>
        {voice === 'first' ? 'Adjusted from earnings' : `Adjusted from ${partnerName}'s earnings`} means
        earnings held back and put towards the buy-in rather than paid out — it reduces the buy-in and
        settles the same amount of what is owed. GST sits on top of a line and moves cash only — it
        never changes what is owed or what has been settled, because the tax is remitted rather than
        earned.
      </p>
    </section>
  )
}

function Balance({ label, value, hint, accent }: {
  label: string; value: number; hint?: string; accent?: boolean
}) {
  return (
    <div className={styles.ledgerBalance}>
      <span className={styles.ledgerBalanceLabel}>{label}</span>
      <span className={accent ? styles.ledgerBalanceAccent : styles.ledgerBalanceValue}>{inr(value)}</span>
      {hint && <span className={styles.ledgerBalanceHint}>{hint}</span>}
    </div>
  )
}

/** Negative amounts keep their sign — an overpaid buy-in is money owed back, not a zero. */
function inr(n: number): string {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
