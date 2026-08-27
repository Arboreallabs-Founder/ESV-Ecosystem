'use client'

import { describeError } from '@/lib/client-errors'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { actOnDeal, addDealMedia, removeDealMedia, setSeen, toggleStar, updateDeskDeal } from '@/app/actions/deal-desk'
import { promoteDeskDealToCompany } from '@/app/actions/companies'
import { DESK_DEAL_STATUS_LABELS } from '@/lib/types'
import type { DeskDeal } from '@/lib/types'
import {
  formatDate, formatInr, formatValuation, initials, sectorBadge,
  arrRunRate, valuationMultiple, valuationSanity, roundProgress, freshnessLabel,
} from './format'
import RevenueBarChart from './RevenueBarChart'
import VoiceRecorder from './VoiceRecorder'
import DealEditModal from './DealEditModal'
import NotesList from './NotesList'
import Spinner from '@/app/_components/Spinner'
import Avatar from '@/app/_components/Avatar'
import styles from './deal-desk.module.css'

const BUCKET = 'deal-desk'

export default function DealDetailOverlay({
  deal,
  canReview,
  isOwner,
  orgId,
  onClose,
  onChanged,
}: {
  deal: DeskDeal
  canReview: boolean
  isOwner: boolean
  orgId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [moreInfoOpen, setMoreInfoOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [opinion, setOpinion] = useState(deal.analyst_opinion ?? '')
  const [promoting, startPromote] = useTransition()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePromote() {
    setError(null)
    startPromote(async () => {
      try { const id = await promoteDeskDealToCompany(deal.id); router.push(`/companies/${id}`) }
      catch (e) { setError(describeError(e).message) }
    })
  }

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn(); onChanged() } catch (e) { setError(describeError(e).message) }
    })
  }

  async function uploadToBucket(prefix: 'voice' | 'gallery', file: Blob, ext: string) {
    const supabase = createClient()
    const path = `${orgId}/${prefix}/${deal.id}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
    if (upErr) throw new Error(upErr.message)
    return path
  }

  function submitReject() { run(() => actOnDeal(deal.id, { actionType: 'reject' })) }
  function submitDiscuss() { run(() => actOnDeal(deal.id, { actionType: 'discuss_in_person' })) }

  function submitMoreInfo() {
    run(async () => {
      let voicePath: string | null = null
      if (voiceBlob) voicePath = await uploadToBucket('voice', voiceBlob, 'webm')
      await actOnDeal(deal.id, { actionType: 'need_more_info', commentText: comment, voiceNotePath: voicePath })
      setMoreInfoOpen(false); setComment(''); setVoiceBlob(null)
    })
  }

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    run(async () => {
      for (const f of files) {
        const ext = f.name.split('.').pop() || 'jpg'
        const path = await uploadToBucket('gallery', f, ext)
        await addDealMedia(deal.id, path)
      }
    })
    e.target.value = ''
  }

  const arr = arrRunRate(deal)
  const mult = valuationMultiple(deal)
  const progress = roundProgress(deal)
  const sanity = valuationSanity(deal)
  const fresh = freshnessLabel(deal.call_date)

  return (
    <>
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div style={{ flex: 1 }}>
            <h2 className={styles.modalTitle}>{deal.company_name}</h2>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {deal.sector && <span className={`${styles.badge} ${styles.badgeSector}`} style={sectorBadge(deal.sector) ?? undefined}>{deal.sector}</span>}
              {deal.stage && <span className={`${styles.badge} ${styles.badgeStage}`}>{deal.stage}</span>}
              <span className={`${styles.statusPill} ${statusClass(deal.deal_status)}`}>{DESK_DEAL_STATUS_LABELS[deal.deal_status]}</span>
              {deal.associate?.name && <span className={styles.founderAff}>· {deal.associate.name}</span>}
              {fresh && <span className={styles.founderAff}>· {fresh}</span>}
            </div>
          </div>
          {isOwner && (
            <button className={styles.ghostBtn} onClick={() => setEditOpen(true)} disabled={pending}>Edit</button>
          )}
          {canReview && (
            <button
              className={`${styles.star} ${deal.starred ? styles.starOn : ''}`}
              onClick={() => run(() => toggleStar(deal.id, !deal.starred))}
              disabled={pending}
              title={deal.starred ? 'Unstar' : 'Flag for follow-up'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={deal.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.modalBody} style={canReview ? { paddingBottom: '1.5rem' } : undefined}>
          {deal.about && <div className={styles.section}><div className={styles.sectionLabel}>About</div><div className={styles.sectionText}>{deal.about}</div></div>}
          {deal.location && <div className={styles.section}><div className={styles.sectionLabel}>Location</div><div className={styles.sectionText}>{deal.location}</div></div>}

          {/* Company profile link / promote */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Company profile</div>
            {deal.company_id ? (
              <a className={styles.sectionText} style={{ color: 'var(--color-primary)' }} href={`/companies/${deal.company_id}`}>View full profile ↗</a>
            ) : (
              <button className={styles.ghostBtn} onClick={handlePromote} disabled={promoting}>
                {promoting
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={13} /> Creating…</span>
                  : '+ Create company profile'}
              </button>
            )}
          </div>

          {/* Analyst's opinion — the author adds it in-app after import */}
          {(isOwner || deal.analyst_opinion) && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Analyst&rsquo;s opinion</div>
              {isOwner ? (
                <>
                  <textarea
                    className={styles.textarea}
                    maxLength={100}
                    rows={2}
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                    placeholder="Your quick take on this deal (max 100 characters)…"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
                    <span className={styles.charCount}>{opinion.length}/100</span>
                    <button
                      className={styles.primaryBtn}
                      style={{ padding: '0.4rem 0.85rem' }}
                      disabled={pending || opinion.trim() === (deal.analyst_opinion ?? '')}
                      onClick={() => run(() => updateDeskDeal(deal.id, { analyst_opinion: opinion }))}
                    >
                      {pending
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={13} className="spinnerOnPrimary" /> Saving…</span>
                        : 'Save opinion'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.opinion}>
                  <svg className={styles.opinionIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {deal.analyst_opinion}
                </div>
              )}
            </div>
          )}

          <div className={styles.stats}>
            <div className={styles.stat}><div className={styles.statLabel}>Ask</div><div className={styles.statValue}>{formatInr(deal.ask_inr)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>Valuation</div><div className={styles.statValue}>{formatValuation(deal.valuation_type, deal.valuation_inr)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>Dilution</div><div className={styles.statValue}>{deal.dilution_percent != null ? `${deal.dilution_percent}%` : '—'}</div></div>
          </div>

          {sanity && sanity.gapPct >= 25 && (
            <div className={styles.sanityWarn}>
              ⚠ Ask ÷ dilution implies a ~{formatInr(sanity.implied)} valuation, but {formatInr(sanity.stated)} is stated ({Math.round(sanity.gapPct)}% gap) — worth clarifying.
            </div>
          )}

          {/* Deal terms */}
          {(deal.business_model || deal.instrument || deal.round_status || deal.total_raised_inr != null || progress) && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Deal terms</div>
              <div className={styles.kpiGrid}>
                {deal.business_model && <Kpi label="Model" value={deal.business_model} />}
                {deal.instrument && <Kpi label="Instrument" value={deal.instrument} />}
                {deal.round_status && <Kpi label="Round" value={deal.round_status} />}
                {deal.total_raised_inr != null && <Kpi label="Raised to date" value={formatInr(deal.total_raised_inr)} />}
              </div>
              {progress && (
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress.pct}%` }} /></div>
                  <div className={styles.progressLabel}>{formatInr(progress.committed)} of {formatInr(progress.ask)} committed · {Math.round(progress.pct)}%</div>
                </div>
              )}
            </div>
          )}

          {/* Key metrics (computed + unit economics) */}
          {(arr != null || deal.gross_margin_pct != null || deal.monthly_burn_inr != null || deal.runway_months != null || deal.customers_count != null) && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Key metrics</div>
              <div className={styles.kpiGrid}>
                {arr != null && <Kpi label="ARR run-rate" value={formatInr(arr)} />}
                {mult != null && <Kpi label="Valuation" value={`${Number(mult.toFixed(1))}× ARR`} />}
                {deal.gross_margin_pct != null && <Kpi label="Gross margin" value={`${deal.gross_margin_pct}%`} />}
                {deal.monthly_burn_inr != null && <Kpi label="Monthly burn" value={formatInr(deal.monthly_burn_inr)} />}
                {deal.runway_months != null && <Kpi label="Runway" value={`${deal.runway_months} mo`} />}
                {deal.customers_count != null && <Kpi label="Customers" value={deal.customers_count.toLocaleString('en-IN')} />}
              </div>
            </div>
          )}

          {deal.revenue_status && (
            <div className={styles.section}>
              <RevenueBarChart status={deal.revenue_status} points={deal.revenue_data} period={deal.revenue_period} />
            </div>
          )}

          {deal.usp && <div className={styles.section}><div className={styles.sectionLabel}>USP</div><div className={styles.sectionText}>{deal.usp}</div></div>}

          {deal.cap_table_notable_names.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Cap table</div>
              {deal.cap_table_notable_names.map((n, i) => <span key={i} className={styles.chip}>{n}</span>)}
            </div>
          )}

          {deal.cap_table_structure_notes && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Cap table notes</div>
              <div className={styles.sectionText}>{deal.cap_table_structure_notes}</div>
            </div>
          )}

          {deal.founders.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Founders</div>
              <div className={styles.founders}>
                {deal.founders.map((f, i) => (
                  <div key={i} className={styles.founderRow} style={{ alignItems: 'flex-start' }}>
                    <div className={styles.avatar}>{initials(f.name)}</div>
                    <div>
                      <div className={styles.founderName}>
                        {f.name}
                        {f.linkedin_url && <a href={f.linkedin_url} target="_blank" rel="noreferrer" style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--color-primary)' }}>LinkedIn ↗</a>}
                      </div>
                      {f.affiliation && <div className={styles.founderAff}>{f.affiliation}</div>}
                      {f.bio && <div className={styles.sectionText} style={{ fontSize: '0.8125rem' }}>{f.bio}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deal.notes && <div className={styles.section}><div className={styles.sectionLabel}>Notes</div><NotesList notes={deal.notes} /></div>}

          <div className={styles.section} style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {deal.referrer && <div><div className={styles.sectionLabel}>Referrer</div><div className={styles.sectionText}>{deal.referrer}</div></div>}
            {deal.call_date && <div><div className={styles.sectionLabel}>Call date</div><div className={styles.sectionText}>{formatDate(deal.call_date)}</div></div>}
            {deal.pitch_deck_url && <div><div className={styles.sectionLabel}>Pitch deck</div><a className={styles.sectionText} style={{ color: 'var(--color-primary)' }} href={deal.pitch_deck_url} target="_blank" rel="noreferrer">Open deck ↗</a></div>}
          </div>

          {/* Gallery — hidden entirely when empty for reviewers; owners always see the uploader */}
          {(deal.media.length > 0 || isOwner) && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Gallery</div>
              {deal.media.length > 0 && (
                <div className={styles.gallery} style={{ flexWrap: 'wrap' }}>
                  {deal.media.map((m) => (
                    <div key={m.id} style={{ position: 'relative' }}>
                      {m.signed_url && <img className={styles.thumb} src={m.signed_url} alt="" />}
                      {isOwner && (
                        <button
                          onClick={() => run(() => removeDealMedia(m.id))}
                          style={{ position: 'absolute', top: -6, right: -6, background: 'var(--color-destructive)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: 1 }}
                          title="Remove"
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isOwner && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
                  <button className={styles.ghostBtn} onClick={() => fileRef.current?.click()} disabled={pending} style={{ marginTop: deal.media.length > 0 ? '0.5rem' : 0 }}>+ Add images</button>
                </>
              )}
            </div>
          )}

          {/* Action thread — the MD's feedback, visible to the author too */}
          {deal.actions.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Activity</div>
              <div className={styles.thread}>
                {deal.actions.map((a) => (
                  <div key={a.id} className={styles.threadItem}>
                    <div className={styles.threadHead}>
                      <Avatar name={a.created_by_user?.name} photoUrl={a.created_by_user?.photo_url} size="xs" />
                      <span className={styles.threadWho}>{a.created_by_user?.name ?? 'Reviewer'}</span>
                      <span className={`${styles.statusPill} ${statusClass(mapActionToStatus(a.action_type))}`}>{DESK_DEAL_STATUS_LABELS[mapActionToStatus(a.action_type)]}</span>
                      <span className={styles.threadWhen}>{formatDate(a.created_at)}</span>
                    </div>
                    {a.comment_text && <div className={styles.threadText}>{a.comment_text}</div>}
                    {a.voice_note_signed_url && <audio className={styles.audio} src={a.voice_note_signed_url} controls />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.errBox}>{error}</div>}
        </div>

        {/* Reviewer action bar */}
        {canReview && (
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', padding: '0.85rem 1.25rem' }}>
            {!moreInfoOpen ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className={`${styles.actionBtn} ${styles.actionReject}`} onClick={submitReject} disabled={pending}>Reject</button>
                <button className={`${styles.actionBtn} ${styles.actionDiscuss}`} onClick={submitDiscuss} disabled={pending}>Discuss in person</button>
                <button className={`${styles.actionBtn} ${styles.actionInfo}`} onClick={() => setMoreInfoOpen(true)} disabled={pending}>Need more info</button>
                <button className={styles.ghostBtn} onClick={() => run(() => setSeen(deal.id, !deal.seen_status))} disabled={pending}>
                  {deal.seen_status ? 'Mark unseen' : 'Mark seen'}
                </button>
              </div>
            ) : (
              <div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Request more info from {deal.associate?.name ?? 'the associate'}</label>
                  <textarea className={styles.textarea} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What else do you need?" />
                </div>
                <VoiceRecorder onRecorded={setVoiceBlob} onCleared={() => setVoiceBlob(null)} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className={styles.primaryBtn} onClick={submitMoreInfo} disabled={pending}>
                    {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Sending…</span> : 'Send request'}
                  </button>
                  <button className={styles.ghostBtn} onClick={() => { setMoreInfoOpen(false); setComment(''); setVoiceBlob(null) }} disabled={pending}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {editOpen && (
      <DealEditModal
        deal={deal}
        onClose={() => setEditOpen(false)}
        onSaved={onChanged}
      />
    )}
    </>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
    </div>
  )
}

function statusClass(status: DeskDeal['deal_status']): string {
  return { open: styles.statusOpen, rejected: styles.statusRejected, discuss: styles.statusDiscuss, more_info: styles.statusMore_info }[status]
}

function mapActionToStatus(action: DeskDeal['actions'][number]['action_type']): DeskDeal['deal_status'] {
  return action === 'reject' ? 'rejected' : action === 'discuss_in_person' ? 'discuss' : 'more_info'
}
