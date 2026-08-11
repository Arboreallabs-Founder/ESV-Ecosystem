'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  addFundraiseEvent, setEventFounderVisible, setFundraiseStatus, setReachoutTemplate,
  shareFundraiseList, syncFromInvestorList, unshareFundraiseList,
} from '@/app/actions/fundraise'
import {
  FUNDRAISE_STATUSES, FUNDRAISE_STATUS_LABELS, FUNDRAISE_STATUS_COLORS, FUNDRAISE_EVENT_LABELS,
  FUNDRAISE_GHOST_DAYS, fundraiseDisplayStatus,
} from '@/lib/types'
import type {
  FundraiseEntry, FundraiseEventKind, FundraiseList, FundraiseStatus,
} from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../fundraise.module.css'

/**
 * The Fundraise Status List.
 *
 * Every approved fund, where it has got to, and everything that has happened to it. Two audiences
 * from one record: the founder sees the major status, whatever we mark as theirs, and any rejection
 * reason — we keep the rest.
 *
 * Ghosted is derived rather than stored, so it cannot disagree with the timeline it is read from
 * and stops being true the moment anything moves.
 */
export default function FundraiseClient({
  list, dealId, dealName, companySector, pendingApproved, investorListId,
}: {
  list: FundraiseList | null
  dealId: string
  dealName: string
  companySector: string | null
  /** Funds the founder approved that are not on the list yet. */
  pendingApproved: number
  investorListId: string | null
}) {
  const router = useRouter()
  const [openEntry, setOpenEntry] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [template, setTemplate] = useState(list?.reachout_template ?? '')
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try { await fn(); router.refresh() } catch (err) { alertError(err) }
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the text is on screen */ }
  }

  const entries = list?.entries ?? []
  const counts = entries.reduce((acc, e) => {
    const s = fundraiseDisplayStatus(e.status, e.status_changed_at)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <Link href={`/active-deals/${dealId}`} className={styles.back}>← {dealName}</Link>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Fundraise status</h1>
            <WikiButton sectionKey="fundraiseStatus" />
          </div>
          <p className={styles.sub}>
            Every fund the founder approved, and where it has got to. They see the major status,
            anything you mark as theirs, and any rejection reason — the rest stays here.
          </p>
        </div>
      </div>

      {/* Funds approved but not pulled across yet. §2: names get added from our end after
          approval, so this is the normal state rather than a problem. */}
      {pendingApproved > 0 && investorListId && (
        <div className={styles.pullBar}>
          <span>
            <strong>{pendingApproved}</strong> approved fund{pendingApproved === 1 ? '' : 's'} not on
            this list yet.
          </span>
          <button
            className={styles.primaryBtn}
            disabled={pending}
            onClick={() => run(() => syncFromInvestorList(investorListId, dealId))}
          >
            {pending ? 'Adding…' : 'Add them'}
          </button>
        </div>
      )}

      {!list ? (
        <div className={styles.empty}>
          Nothing here yet. Once the founder has approved an investor list, pull the approved funds
          across and they become the mandate&apos;s working list.
          {investorListId && (
            <div style={{ marginTop: '1rem' }}>
              <button
                className={styles.primaryBtn}
                disabled={pending}
                onClick={() => run(() => syncFromInvestorList(investorListId, dealId))}
              >
                Start the fundraise list
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* The agreed outreach email, at the top. Whoever sends the next one copies this rather
              than writing their own — which is the whole point of it living here. Internal only. */}
          <section className={styles.templateBlock}>
            <div className={styles.templateHead}>
              <span className={styles.blockTitle}>Reachout email — internal only</span>
              <div className={styles.templateActions}>
                {template && !editingTemplate && (
                  <button className={styles.ghostBtn} onClick={() => copy(template)}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button className={styles.ghostBtn} onClick={() => setEditingTemplate((v) => !v)}>
                  {editingTemplate ? 'Cancel' : template ? 'Edit' : 'Write one'}
                </button>
              </div>
            </div>
            {editingTemplate ? (
              <>
                <textarea
                  className={styles.textarea}
                  rows={8}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="The wording the team agreed for this mandate."
                />
                <button
                  className={styles.primaryBtn}
                  disabled={pending}
                  onClick={() => run(async () => {
                    await setReachoutTemplate(list.id, template, dealId)
                    setEditingTemplate(false)
                  })}
                >
                  {pending ? 'Saving…' : 'Save template'}
                </button>
              </>
            ) : template ? (
              <pre className={styles.templateBody}>{template}</pre>
            ) : (
              <p className={styles.templateEmpty}>
                No template yet. Writing one here means the next person to send this deal out uses
                the same wording instead of inventing it.
              </p>
            )}
          </section>

          {/* The founder's link. Its own token, separate from the approval list's. */}
          <section className={styles.shareBlock}>
            <div>
              <div className={styles.blockTitle}>Founder link</div>
              <p className={styles.shareSub}>
                Shows the major status of each fund, the updates you mark as theirs, and any
                rejection reason. They can comment against a fund; they cannot see this page.
              </p>
            </div>
            {list.shared_at ? (
              <div className={styles.shareRow}>
                <code className={styles.linkBox}>{`${origin}/fr/${list.share_token}`}</code>
                <button className={styles.ghostBtn} onClick={() => copy(`${origin}/fr/${list.share_token}`)}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  className={styles.ghostBtn}
                  disabled={pending}
                  onClick={() => run(() => unshareFundraiseList(list.id, dealId))}
                >
                  Withdraw
                </button>
              </div>
            ) : (
              <button
                className={styles.primaryBtn}
                disabled={pending}
                onClick={() => run(() => shareFundraiseList(list.id, dealId))}
              >
                Share with the founder
              </button>
            )}
          </section>

          {/* Where the mandate stands, in one line. */}
          {entries.length > 0 && (
            <div className={styles.counts}>
              {(Object.keys(counts) as Array<keyof typeof FUNDRAISE_STATUS_LABELS>)
                .sort()
                .map((s) => (
                  <span key={s} className={styles.countChip}>
                    <span className={styles.countDot} style={{ background: FUNDRAISE_STATUS_COLORS[s] }} />
                    {FUNDRAISE_STATUS_LABELS[s]}
                    <strong>{counts[s]}</strong>
                  </span>
                ))}
            </div>
          )}

          <div className={styles.list}>
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                dealId={dealId}
                companySector={companySector}
                open={openEntry === entry.id}
                onToggle={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
                onRun={run}
                pending={pending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EntryRow({
  entry, dealId, companySector, open, onToggle, onRun, pending,
}: {
  entry: FundraiseEntry
  dealId: string
  companySector: string | null
  open: boolean
  onToggle: () => void
  onRun: (fn: () => Promise<unknown>) => void
  pending: boolean
}) {
  const display = fundraiseDisplayStatus(entry.status, entry.status_changed_at)
  const [statusDraft, setStatusDraft] = useState<FundraiseStatus>(entry.status)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [visible, setVisible] = useState(false)
  const [eventKind, setEventKind] = useState<Exclude<FundraiseEventKind, 'status_change' | 'founder_comment'>>('outreach')
  const [eventBody, setEventBody] = useState('')
  const [eventVisible, setEventVisible] = useState(false)

  const daysStill = Math.floor(
    (Date.now() - new Date(entry.status_changed_at).getTime()) / 86_400_000,
  )
  const primary = entry.investor?.contacts.find((c) => c.rank === 'primary')

  return (
    <article className={styles.entry}>
      <button className={styles.entryHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.entryName}>
          {entry.investor?.logo_url && (
            <img src={entry.investor.logo_url} alt="" className={styles.entryLogo} />
          )}
          <span className={styles.entryNameText}>{entry.investor?.name ?? 'Removed'}</span>
          {entry.investor?.connect_strength === 'warm' && <span className={styles.warm}>Warm</span>}
        </span>

        <span className={styles.entryStatus} style={{ color: FUNDRAISE_STATUS_COLORS[display] }}>
          <span className={styles.countDot} style={{ background: FUNDRAISE_STATUS_COLORS[display] }} />
          {FUNDRAISE_STATUS_LABELS[display]}
        </span>

        {/* How long it has sat still — the number the ghosting rule reads, shown rather than left
            to be worked out from a date. */}
        <span className={display === 'ghosted' ? styles.staleWarn : styles.stale}>
          {daysStill === 0 ? 'today' : `${daysStill}d`}
          {display === 'ghosted' && ` · no reply in ${FUNDRAISE_GHOST_DAYS}+ days`}
        </span>

        <span className={open ? styles.chevOpen : styles.chev} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={styles.entryBody}>
          {!primary && (
            <div className={styles.warnInline}>
              No confirmed contact at this fund. Establishing one comes before the rest of the
              workflow — otherwise there is no evidence the deal ever reached them.
            </div>
          )}

          <div className={styles.panels}>
            {/* Move the status. */}
            <div className={styles.panel}>
              <div className={styles.blockTitle}>Move it on</div>
              <select
                className={styles.select}
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as FundraiseStatus)}
              >
                {FUNDRAISE_STATUSES.map((s) => (
                  <option key={s} value={s}>{FUNDRAISE_STATUS_LABELS[s]}</option>
                ))}
              </select>

              {statusDraft === 'rejected' && (
                <>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`Why did they pass? e.g. "too early for their stage", "already hold a competitor"`}
                  />
                  <p className={styles.hint}>
                    Required. It is what the founder sees, and it is what builds up this fund&apos;s
                    profile — what they have looked at, and what they say no to.
                  </p>
                </>
              )}

              {statusDraft !== 'rejected' && (
                <>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything worth recording with the change (optional)"
                  />
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                    The founder can see this note
                  </label>
                </>
              )}

              <button
                className={styles.primaryBtn}
                disabled={pending}
                onClick={() => onRun(async () => {
                  await setFundraiseStatus({
                    entryId: entry.id,
                    status: statusDraft,
                    note,
                    rejectionReason: reason,
                    rejectionSector: companySector,
                    founderVisible: visible,
                    activeDealId: dealId,
                  })
                  setNote(''); setReason(''); setVisible(false)
                })}
              >
                {pending ? 'Saving…' : 'Update status'}
              </button>
            </div>

            {/* Log anything else. */}
            <div className={styles.panel}>
              <div className={styles.blockTitle}>Log something</div>
              <select
                className={styles.select}
                value={eventKind}
                onChange={(e) => setEventKind(e.target.value as typeof eventKind)}
              >
                {(['outreach', 'follow_up', 'request', 'response', 'note'] as const).map((k) => (
                  <option key={k} value={k}>{FUNDRAISE_EVENT_LABELS[k]}</option>
                ))}
              </select>
              <textarea
                className={styles.textarea}
                rows={3}
                value={eventBody}
                onChange={(e) => setEventBody(e.target.value)}
                placeholder="What happened?"
              />
              <label className={styles.checkRow}>
                <input type="checkbox" checked={eventVisible} onChange={(e) => setEventVisible(e.target.checked)} />
                The founder can see this
              </label>
              <button
                className={styles.primaryBtn}
                disabled={pending || !eventBody.trim()}
                onClick={() => onRun(async () => {
                  await addFundraiseEvent({
                    entryId: entry.id, kind: eventKind, body: eventBody,
                    founderVisible: eventVisible, activeDealId: dealId,
                  })
                  setEventBody(''); setEventVisible(false)
                })}
              >
                {pending ? 'Saving…' : 'Add to the timeline'}
              </button>
            </div>
          </div>

          {/* The full history. Everything, in order. */}
          <div className={styles.timeline}>
            <div className={styles.blockTitle}>Everything that has happened</div>
            {(entry.events ?? []).length === 0 ? (
              <p className={styles.timelineEmpty}>Nothing logged yet.</p>
            ) : (
              (entry.events ?? []).map((ev) => (
                <div key={ev.id} className={styles.event}>
                  <span
                    className={styles.eventDot}
                    style={{ background: ev.to_status
                      ? FUNDRAISE_STATUS_COLORS[ev.to_status]
                      : 'var(--color-border)' }}
                  />
                  <div className={styles.eventBody}>
                    <div className={styles.eventHead}>
                      <strong>{FUNDRAISE_EVENT_LABELS[ev.kind]}</strong>
                      {ev.kind === 'status_change' && ev.to_status && (
                        <span className={styles.muted}>
                          {ev.from_status ? `${FUNDRAISE_STATUS_LABELS[ev.from_status]} → ` : ''}
                          {FUNDRAISE_STATUS_LABELS[ev.to_status]}
                        </span>
                      )}
                      <span className={styles.muted}>
                        {ev.created_by_user?.name ?? ev.author_label ?? 'Someone'} ·{' '}
                        {formatDateTimeIst(ev.created_at)}
                      </span>
                      {ev.kind !== 'founder_comment' && (
                        <button
                          className={ev.founder_visible ? styles.visOn : styles.visOff}
                          disabled={pending}
                          title={ev.founder_visible
                            ? 'The founder can see this. Click to keep it internal.'
                            : 'Internal. Click to show the founder.'}
                          onClick={() => onRun(() =>
                            setEventFounderVisible(ev.id, !ev.founder_visible, dealId))}
                        >
                          {ev.founder_visible ? 'Founder sees this' : 'Internal'}
                        </button>
                      )}
                    </div>
                    {ev.body && <p className={styles.eventText}>{ev.body}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  )
}
