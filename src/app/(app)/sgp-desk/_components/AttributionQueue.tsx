'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  coordinatorApprove, founderApprove, founderApproveMany, rejectAttribution, withdrawAttribution,
} from '@/app/actions/partner-attribution'
import {
  ATTRIBUTION_SOURCE_LABELS, ATTRIBUTION_STATUS_COLORS, ATTRIBUTION_STATUS_LABELS,
  claimSubjectName,
} from '@/lib/types'
import type { PartnerAttributionClaim } from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import Avatar from '@/app/_components/Avatar'
import styles from '../sgp-desk.module.css'

/**
 * The attribution ledger, as a Monday agenda.
 *
 * Three sections in the order the work moves: what the coordinator owes an answer on, what is
 * sitting with the founder, and what has been settled. Everything a partner could be paid for
 * appears here whatever route it arrived by — a form submission, an investor referral, or somebody
 * tagging a record in the database months later — because they are all the same claim on the same
 * money, and splitting them across screens is how one gets missed.
 */
export default function AttributionQueue({
  claims, canCoordinate, canApprove,
}: {
  claims: PartnerAttributionClaim[]
  canCoordinate: boolean
  /** Holds the second signature. Nimit, unless somebody else has been given it. */
  canApprove: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<PartnerAttributionClaim | null>(null)
  const [reason, setReason] = useState('')

  const withCoordinator = claims.filter((c) => c.status === 'pending_coordinator')
  const withFounder = claims.filter((c) => c.status === 'pending_founder')
  // Settled, most recent first — enough to review the week, not the whole history.
  const decided = claims.filter((c) => c.status === 'approved' || c.status === 'rejected').slice(0, 25)

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try { await fn(); router.refresh() } catch (err) { alertError(err) }
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function Card({ claim, actions }: { claim: PartnerAttributionClaim; actions?: React.ReactNode }) {
    const subject = claimSubjectName(claim)
    const href = claim.company_id ? `/companies/${claim.company_id}`
      : claim.investor_id ? `/investors/${claim.investor_id}` : null

    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardWho}>
            <div className={styles.cardName}>
              {href ? <Link href={href} className={styles.link}>{subject}</Link> : subject}
              <span className={styles.claimKind}>{claim.company_id ? 'Company' : 'Investor'}</span>
            </div>
            <div className={styles.cardMeta}>
              {claim.partner?.name ?? 'Unknown partner'} · {ATTRIBUTION_SOURCE_LABELS[claim.source]}
              {' · '}{formatDateTimeIst(claim.created_at)}
            </div>
          </div>
          <span
            className={styles.claimStatus}
            style={{
              color: ATTRIBUTION_STATUS_COLORS[claim.status],
              borderColor: `${ATTRIBUTION_STATUS_COLORS[claim.status]}55`,
              background: `${ATTRIBUTION_STATUS_COLORS[claim.status]}12`,
            }}
          >
            {ATTRIBUTION_STATUS_LABELS[claim.status]}
          </span>
        </div>

        {claim.note && <div className={styles.comments}>{claim.note}</div>}

        {/* Who has already signed. On a call this is the first thing anyone asks, and it is the
            check that stops one person being both signatures. */}
        {(claim.coordinator_at || claim.founder_at) && (
          <div className={styles.signatures}>
            {claim.coordinator_at && (
              <span className={styles.signature}>
                {claim.coordinator?.name
                  ? <><Avatar name={claim.coordinator.name} photoUrl={null} size="xs" /> {claim.coordinator.name}</>
                  : 'Tagged before approvals existed'}
                {' — coordinator'}
              </span>
            )}
            {claim.founder_at && claim.founder?.name && (
              <span className={styles.signature}>
                <Avatar name={claim.founder.name} photoUrl={null} size="xs" /> {claim.founder.name} — founder
              </span>
            )}
          </div>
        )}
        {claim.rejected_note && <div className={styles.closed}>Not credited: {claim.rejected_note}</div>}

        {actions && <div className={styles.cardActions}>{actions}</div>}
      </div>
    )
  }

  return (
    <section className={styles.claimBlock}>
      <div className={styles.claimHead}>
        <div>
          <h2 className={styles.claimTitle}>Partner attribution</h2>
          <p className={styles.claimSub}>
            Every claim that a partner introduced something, whatever route it came in by. A
            coordinator signs first, then the founder — and only then is anyone credited.
          </p>
        </div>
      </div>

      {/* ── Waiting on a coordinator ───────────────────────────────────── */}
      <h3 className={styles.claimSection}>
        With the coordinator <span className={styles.claimCount}>{withCoordinator.length}</span>
      </h3>
      {withCoordinator.length === 0 ? (
        <div className={styles.empty}>Nothing waiting on a coordinator.</div>
      ) : (
        <div className={styles.list}>
          {withCoordinator.map((c) => (
            <Card
              key={c.id}
              claim={c}
              actions={canCoordinate ? (
                <>
                  <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => coordinatorApprove(c.id))}>
                    Approve → founder
                  </button>
                  <button className={styles.ghostBtn} disabled={pending} onClick={() => { setRejecting(c); setReason('') }}>
                    Not credited
                  </button>
                </>
              ) : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Waiting on the founder ─────────────────────────────────────── */}
      <h3 className={styles.claimSection}>
        With the founder <span className={styles.claimCount}>{withFounder.length}</span>
      </h3>
      {withFounder.length === 0 ? (
        <div className={styles.empty}>Nothing waiting on the founder.</div>
      ) : (
        <>
          {/* Batch sign-off. A queue that can only be cleared one modal at a time is a queue that
              does not get cleared while six people wait on a call. */}
          {canApprove && withFounder.length > 1 && (
            <div className={styles.batchBar}>
              <label className={styles.batchAll}>
                <input
                  type="checkbox"
                  checked={selected.size === withFounder.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(withFounder.map((c) => c.id)) : new Set())}
                />
                Select all {withFounder.length}
              </label>
              <button
                className={styles.primaryBtn}
                disabled={selected.size === 0 || pending}
                onClick={() => run(async () => {
                  const res = await founderApproveMany([...selected])
                  setSelected(new Set())
                  if (res.failed.length > 0) {
                    alert(`${res.approved} approved. ${res.failed.length} could not be:\n`
                      + res.failed.map((f) => `• ${f.message}`).join('\n'))
                  }
                })}
              >
                {pending ? 'Approving…' : `Approve ${selected.size || ''}`.trim()}
              </button>
            </div>
          )}
          <div className={styles.list}>
            {withFounder.map((c) => (
              <div key={c.id} className={styles.claimRow}>
                {canApprove && withFounder.length > 1 && (
                  <input
                    type="checkbox"
                    className={styles.claimCheck}
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                )}
                <div className={styles.claimRowBody}>
                  <Card
                    claim={c}
                    actions={canApprove ? (
                      <>
                        <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => founderApprove(c.id))}>
                          Approve the credit
                        </button>
                        <button className={styles.ghostBtn} disabled={pending} onClick={() => { setRejecting(c); setReason('') }}>
                          Not credited
                        </button>
                      </>
                    ) : (
                      <span className={styles.awaiting}>Waiting on the founder.</span>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Settled ────────────────────────────────────────────────────── */}
      {decided.length > 0 && (
        <>
          <h3 className={styles.claimSection}>Decided</h3>
          <div className={styles.list}>
            {decided.map((c) => (
              <Card
                key={c.id}
                claim={c}
                actions={canApprove && c.status === 'approved' ? (
                  <button className={styles.ghostBtn} disabled={pending} onClick={() => { setRejecting(c); setReason('') }}>
                    Withdraw the credit
                  </button>
                ) : undefined}
              />
            ))}
          </div>
        </>
      )}

      {rejecting && (
        <div className={styles.overlay} onMouseDown={() => setRejecting(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {rejecting.status === 'approved' ? 'Withdraw the credit' : 'Not credited'}
            </h3>
            <p className={styles.modalSub}>
              {claimSubjectName(rejecting)} — {rejecting.partner?.name ?? 'this partner'}.
              {' '}The reason is what the partner is told, so write it for them.
            </p>
            <textarea
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this not being credited?"
              autoFocus
            />
            <div className={styles.cardActions}>
              <button className={styles.ghostBtn} onClick={() => setRejecting(null)}>Cancel</button>
              <button
                className={styles.primaryBtn}
                disabled={!reason.trim() || pending}
                onClick={() => {
                  const claim = rejecting
                  const text = reason
                  setRejecting(null)
                  run(() => claim.status === 'approved'
                    ? withdrawAttribution(claim.id, text)
                    : rejectAttribution(claim.id, text))
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
