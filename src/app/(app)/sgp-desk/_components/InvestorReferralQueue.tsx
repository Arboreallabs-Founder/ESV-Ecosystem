'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  acceptReferralAsNew, acceptReferralOntoExisting, findInvestorMatches, rejectInvestorReferral,
} from '@/app/actions/partner-investor-referrals'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { PartnerInvestorReferral, ServiceType } from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../sgp-desk.module.css'

type Match = {
  id: string
  name: string
  service_type: string | null
  country: string | null
  website: string | null
  referred_by_partner_id: string | null
}

/**
 * Investor referrals from partners, and the decision on each.
 *
 * The decision that matters is "do we already hold this fund". Getting it wrong creates a duplicate
 * record and a second claim on one relationship, which is the whole reason partners no longer add
 * investors themselves. So the queue does the lookup for the coordinator rather than trusting them
 * to remember 297 fund names — and shows loose matches, because "Elixiir" against "Elixir" is
 * exactly the pair a strict search misses.
 */
export default function InvestorReferralQueue({ referrals }: { referrals: PartnerInvestorReferral[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [types, setTypes] = useState<Record<string, ServiceType | ''>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  const waiting = referrals.filter((r) => r.status === 'pending')
  const decided = referrals.filter((r) => r.status !== 'pending')

  async function openReferral(r: PartnerInvestorReferral) {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id)
    setRejecting(null)
    setMatches([])
    setLoadingMatches(true)
    try {
      setMatches(await findInvestorMatches(r.name))
    } catch (err) {
      alertError(err)
    } finally {
      setLoadingMatches(false)
    }
  }

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setOpenId(null)
        setRejecting(null)
        setReason('')
        router.refresh()
      } catch (err) {
        alertError(err)
      }
    })
  }

  if (referrals.length === 0) return null

  return (
    <section className={styles.referralSection}>
      <div className={styles.referralHead}>
        <h2 className={styles.referralTitle}>Investor referrals</h2>
        <span className={styles.referralCount}>{waiting.length} waiting</span>
      </div>
      <p className={styles.referralSub}>
        Partners cannot add investors themselves — a fund we already hold would become a duplicate
        record and a second claim on one relationship. Check the matches below, then either tag the
        fund we have or add it new. Both credit the partner.
      </p>

      {waiting.map((r) => (
        <div key={r.id} className={styles.referralCard}>
          <button className={styles.referralRow} onClick={() => openReferral(r)}>
            <span className={styles.referralName}>{r.name}</span>
            <span className={styles.referralPartner}>{r.partner?.name ?? 'Unknown partner'}</span>
            <span className={styles.referralDate}>{formatDateTimeIst(r.created_at)}</span>
            <span className={styles.referralChevron}>{openId === r.id ? '▴' : '▾'}</span>
          </button>

          {openId === r.id && (
            <div className={styles.referralBody}>
              <dl className={styles.referralFacts}>
                {r.contact_name && <><dt>Their contact</dt><dd>{r.contact_name}</dd></>}
                {r.contact_email && <><dt>Email</dt><dd>{r.contact_email}</dd></>}
                {r.contact_phone && <><dt>Phone</dt><dd>{r.contact_phone}</dd></>}
                {r.website && <><dt>Website</dt><dd>{r.website}</dd></>}
              </dl>
              {r.notes && <p className={styles.referralNotes}>{r.notes}</p>}

              <div className={styles.referralMatches}>
                <div className={styles.referralMatchTitle}>
                  {loadingMatches
                    ? 'Checking what we already hold…'
                    : matches.length === 0
                      ? 'Nothing similar in the database.'
                      : `${matches.length} possible match${matches.length === 1 ? '' : 'es'} already on file`}
                </div>
                {matches.map((m) => (
                  <div key={m.id} className={styles.referralMatch}>
                    <span className={styles.referralMatchName}>{m.name}</span>
                    <span className={styles.referralMatchMeta}>
                      {[m.country, m.website].filter(Boolean).join(' · ') || '—'}
                    </span>
                    {/* Already credited elsewhere is a fee question, not a click. The action
                        refuses it too; saying so here saves the round trip. */}
                    {m.referred_by_partner_id && m.referred_by_partner_id !== r.partner_id ? (
                      <span className={styles.referralTaken}>Credited to another partner</span>
                    ) : (
                      <button
                        className={styles.referralLinkBtn}
                        disabled={pending}
                        onClick={() => run(() => acceptReferralOntoExisting(r.id, m.id))}
                      >
                        This one — tag it to {r.partner?.name ?? 'them'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {rejecting === r.id ? (
                <div className={styles.referralReject}>
                  <textarea
                    className={styles.referralReasonBox}
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why not? The partner sees this — «no» on its own is what stops people referring."
                    autoFocus
                  />
                  <div className={styles.referralActions}>
                    <button className={styles.referralGhost} onClick={() => setRejecting(null)}>Cancel</button>
                    <button
                      className={styles.referralDanger}
                      disabled={pending || !reason.trim()}
                      onClick={() => run(() => rejectInvestorReferral(r.id, reason))}
                    >
                      {pending ? 'Saving…' : 'Send this back'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.referralActions}>
                  <button className={styles.referralGhost} onClick={() => setRejecting(r.id)}>
                    Not taken forward
                  </button>
                  {/* Asked rather than guessed. The type decides whether this record can ever
                      appear on a founder-facing investor list — angels are excluded there so a
                      founder's raise plans never reach somebody who knows them personally — and a
                      default nobody chose would defeat that quietly. */}
                  <select
                    className={styles.referralType}
                    // Pre-filled with what the partner told us. The coordinator confirms rather
                    // than guesses, and can still override if the partner had it wrong.
                    value={types[r.id] ?? r.service_type ?? ''}
                    onChange={(e) => setTypes((p) => ({ ...p, [r.id]: e.target.value as ServiceType }))}
                    aria-label="What kind of investor is this?"
                  >
                    <option value="">What kind of investor?</option>
                    {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((t) => (
                      <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <button
                    className={styles.referralPrimary}
                    disabled={pending || !(types[r.id] ?? r.service_type)}
                    title={(types[r.id] ?? r.service_type) ? undefined : 'Pick what kind of investor they are first'}
                    onClick={() => run(() => acceptReferralAsNew(r.id, (types[r.id] ?? r.service_type) as ServiceType))}
                  >
                    {pending ? 'Adding…' : 'We don’t have them — add as new'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {decided.length > 0 && (
        <details className={styles.referralDecided}>
          <summary>{decided.length} already decided</summary>
          {decided.map((r) => (
            <div key={r.id} className={styles.referralRowStatic}>
              <span className={styles.referralName}>{r.investor?.name ?? r.name}</span>
              <span className={styles.referralPartner}>{r.partner?.name ?? '—'}</span>
              <span className={r.status === 'accepted' ? styles.referralOk : styles.referralNo}>
                {r.status === 'accepted' ? 'Accepted' : 'Not taken forward'}
              </span>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
