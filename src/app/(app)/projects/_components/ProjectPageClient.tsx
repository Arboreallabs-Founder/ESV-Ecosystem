'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhaseBar from '@/app/_components/PhaseBar'
import Avatar from '@/app/_components/Avatar'
import PeoplePicker, { type PickablePerson } from '@/app/_components/PeoplePicker'
import { describeError } from '@/lib/client-errors'
import {
  MEMBER_ROLES, PROJECT_STAGES, ROLE_META, SERVICES, SERVICE_META, STAGE_META,
  cartTotals, formatInr, nextStepAction, serviceLabel, trackFor,
  type ProjectDetail, type ProjectService, type ProjectStage,
} from '@/lib/project-model'
import {
  acceptProposal, addChecklistItem, markAllChecklistReceived, addProjectNote, addProjectService, clearPayment, completeFirstCall,
  completeProject, deleteProject, finishDataGathering, logChangeRequest, markProposalSent, moveServiceStep,
  overrideStage, recordPayment, rejectProposal, removeChecklistItem, removeProjectService, reviveProject,
  scheduleFirstCall, setChecklistStatus, setProjectPartner, setProjectRole, updateProjectBasics, updateProjectService,
} from '@/app/actions/projects'
import styles from '../projects.module.css'

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null
const fmtShort = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null
/** Which week of the standard four-week engagement we're in, counted from when work started. */
const engagementWeek = (startedIso: string) =>
  Math.min(4, Math.floor((Date.now() - new Date(startedIso).getTime()) / (7 * 86_400_000)) + 1)

export default function ProjectPageClient({ project: p, people, partners, isFounderAdmin, canRecordPayments }: {
  project: ProjectDetail
  people: PickablePerson[]
  partners: Array<{ id: string; name: string }>
  isFounderAdmin: boolean
  canRecordPayments: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  /** Run an action, surface its refusal, refresh the view. */
  function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        after?.()
        router.refresh()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  const totals = cartTotals(p.services)
  const started = ['work', 'handover', 'completed'].includes(p.stage)
  const checklistSeeded = p.checklist.length > 0
  const pendingItems = p.checklist.filter((i) => i.status === 'pending').length

  const stageDates: Partial<Record<ProjectStage, string | null>> = {
    lead: fmtShort(p.created_at),
    first_call: fmtShort(p.first_call_at),
    proposal: fmtShort(p.proposal_sent_at),
    data: fmtShort(p.proposal_decided_at),
    advance: fmtShort(p.advance_received_at),
    work: fmtShort(p.work_started_at),
    [p.stage]: fmtShort(p.stage_changed_at),
  }

  return (
    <div className={styles.page}>
      <Link href="/projects" className={styles.backLink}>← Projects</Link>

      <div className={styles.projectHeader}>
        <div className={styles.projectHeaderTop}>
          {p.company?.logo_url
            // eslint-disable-next-line @next/next/no-img-element -- small remote logo
            ? <img src={p.company.logo_url} alt="" className={styles.logoLg} />
            : <span className={`${styles.logoFallback} ${styles.logoLg}`}>{p.name.slice(0, 1).toUpperCase()}</span>}
          <div className={styles.projectHeaderText}>
            <div className={styles.pageTitle}>{p.name}</div>
            <div className={styles.pageSub}>
              <span className={`${styles.stageBadge} ${p.stage === 'dormant' ? styles.stageBadgeMuted : ''}`}>{STAGE_META[p.stage].label}</span>
              {p.company && <> · <Link href={`/companies/${p.company.id}`} className={styles.inlineLink}>Company profile</Link></>}
              {p.partner && <> · <span className={styles.partnerTag}>Partner: {p.partner.name}</span></>}
              {p.work_started_at && p.stage === 'work' && <> · Week {engagementWeek(p.work_started_at)} of 4</>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <ClientLinkButton token={p.share_token} />
            {p.drive_url && <a href={p.drive_url} target="_blank" rel="noreferrer" className={styles.ghostBtn}>Drive folder ↗</a>}
            {p.proposal_url && <a href={p.proposal_url} target="_blank" rel="noreferrer" className={styles.ghostBtn}>Proposal ↗</a>}
          </div>
        </div>
        <PhaseBar stage={p.stage} variant="detailed" dates={stageDates} />
      </div>

      {error && <div className={styles.errorBanner} role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss">✕</button></div>}

      <NextStep p={p} run={run} pending={pending} totals={totals} pendingItems={pendingItems} canRecordPayments={canRecordPayments} />

      <div className={styles.detailGrid}>
        {/* ── Services & pricing ─────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Services &amp; pricing <span className={styles.panelHint}>ex-GST</span></div>
          <ServicesCart p={p} run={run} pending={pending} totals={totals} />
        </section>

        {/* ── Team ───────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Team</div>
          {MEMBER_ROLES.map((role) => (
            <div key={role} className={styles.roleRow}>
              <div className={styles.roleLabel}>{ROLE_META[role].label}<span className={styles.roleHint}>{ROLE_META[role].hint}</span></div>
              <PeoplePicker
                people={people}
                value={p.members.filter((m) => m.role === role).map((m) => m.user_id)}
                onChange={(ids) => run(() => setProjectRole(p.id, role, ids))}
                placeholder={`Add ${ROLE_META[role].label.toLowerCase()}…`}
              />
            </div>
          ))}
          {isFounderAdmin && (
            <div className={styles.roleRow}>
              <div className={styles.roleLabel}>Partner<span className={styles.roleHint}>They’ll see the project on their portal</span></div>
              <select className={styles.formInput} value={p.partner?.id ?? ''} disabled={pending}
                      onChange={(e) => run(() => setProjectPartner(p.id, e.target.value || null))}>
                <option value="">No partner</option>
                {partners.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </div>
          )}
        </section>

        {/* ── Deliverables ───────────────────────────────────── */}
        {started && p.services.length > 0 && (
          <section className={`${styles.panel} ${styles.panelWide}`}>
            <div className={styles.panelTitle}>Deliverables</div>
            {p.services.map((s) => {
              const track = trackFor(s.service)
              const next = nextStepAction(s.service, s.step)
              const i = track.findIndex((t) => t.step === s.step)
              return (
                <div key={s.id} className={styles.trackRow}>
                  <div className={styles.trackHead}>
                    <div className={styles.trackName}>{serviceLabel(s.service, s.label)}</div>
                    <div className={styles.trackActions}>
                      {i > 0 && p.stage !== 'completed' && (
                        <button className={styles.linkBtn} disabled={pending} onClick={() => run(() => moveServiceStep(s.id, 'back'))}>Undo</button>
                      )}
                      {next && p.stage === 'work' && (
                        <button className={styles.smallPrimaryBtn} disabled={pending} onClick={() => run(() => moveServiceStep(s.id, 'forward'))}>
                          {next} ✓
                        </button>
                      )}
                    </div>
                  </div>
                  <PhaseBar
                    stage={s.step as ProjectStage}
                    variant="detailed"
                    steps={track.map((t) => ({ key: t.step, label: t.label }))}
                  />
                </div>
              )
            })}
            <div className={styles.panelNote}>
              Two drafts before the final. The final goes out once the balance is in.
              {p.services.some((s) => s.service === 'valuation') && ' The valuation model goes to the registered valuer, and the report is drafted once they approve it.'}
            </div>
          </section>
        )}

        {/* ── Data checklist ─────────────────────────────────── */}
        {checklistSeeded && (
          <section className={`${styles.panel} ${styles.panelWide}`}>
            <div className={styles.panelTitle}>
              Data checklist
              <span className={styles.panelHint}>{p.checklist.length - pendingItems} of {p.checklist.length} in</span>
              {pendingItems > 0 && (
                <button className={`${styles.smallPrimaryBtn} ${styles.panelTitleAction}`} disabled={pending}
                        onClick={() => run(() => markAllChecklistReceived(p.id))}>
                  Received all data required ✓
                </button>
              )}
            </div>
            <Checklist p={p} run={run} pending={pending} />
          </section>
        )}

        {/* ── Payments ───────────────────────────────────────── */}
        {['data', 'advance', 'work', 'handover', 'completed'].includes(p.stage) && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>Payments</div>
            <PaymentRow label="Advance (50%)" kind="advance" expected={totals.advanceGross} receivedAt={p.advance_received_at} amount={p.advance_amount_inr}
                        p={p} run={run} pending={pending} canRecord={canRecordPayments} canUndo={isFounderAdmin} />
            <PaymentRow label="Balance (50%)" kind="balance" expected={totals.gross - totals.advanceGross} receivedAt={p.balance_received_at} amount={p.balance_amount_inr}
                        p={p} run={run} pending={pending} canRecord={canRecordPayments && started} canUndo={isFounderAdmin} />
            <div className={styles.panelNote}>Expected amounts include 18% GST.{!canRecordPayments && ' A founder, an admin or the project lead records payments.'}</div>
          </section>
        )}

        {/* ── Links ──────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Links</div>
          <LinkField label="Google Drive folder" value={p.drive_url} placeholder="https://drive.google.com/…" pending={pending}
                     onSave={(v) => run(() => updateProjectBasics(p.id, { drive_url: v }))} />
          <LinkField label="Proposal" value={p.proposal_url} placeholder="Link to the proposal PDF or doc" pending={pending}
                     onSave={(v) => run(() => updateProjectBasics(p.id, { proposal_url: v }))} />
          {p.notes && <div className={styles.notesBox}>{p.notes}</div>}
        </section>

        {/* ── Changes after handover ─────────────────────────── */}
        {(p.stage === 'handover' || p.stage === 'completed') && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>Changes after handover <span className={styles.panelHint}>{p.changes_used} of 2 used</span></div>
            <ChangeRequest p={p} run={run} pending={pending} />
          </section>
        )}

        {/* ── Tasks ──────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Tasks <span className={styles.panelHint}>raised automatically</span></div>
          {p.tasks.length === 0 ? (
            <div className={styles.muted}>None yet.</div>
          ) : (
            <ul className={styles.taskList}>
              {p.tasks.map((t) => (
                <li key={t.id} className={`${styles.taskRow} ${t.status === 'Done' ? styles.taskDone : ''}`}>
                  <span className={styles.taskCheck}>{t.status === 'Done' ? '✓' : ''}</span>
                  <span className={styles.taskTitle}>{t.title}</span>
                  {t.due_date && t.status !== 'Done' && <span className={styles.taskDue}>{fmtShort(t.due_date)}</span>}
                  {t.assignee
                    ? <Avatar name={t.assignee.name} photoUrl={t.assignee.photo_url} size="xs" />
                    : <span className={styles.taskUnassigned} title="Nobody holds this role yet">?</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Timeline ───────────────────────────────────────── */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.panelTitle}>Timeline</div>
          <NoteInput pending={pending} onAdd={(body) => run(() => addProjectNote(p.id, body))} />
          <ul className={styles.timeline}>
            {p.events.map((e) => (
              <li key={e.id} className={styles.timelineItem}>
                <span className={`${styles.timelineDot} ${styles[`kind_${e.kind}`] ?? ''}`} />
                <div className={styles.timelineBody}>
                  <div>{e.body}</div>
                  <div className={styles.timelineMeta}>{e.author?.name ?? 'System'} · {fmtDate(e.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {isFounderAdmin && <AdminTools p={p} run={run} pending={pending} onDeleted={() => router.push('/projects')} />}
    </div>
  )
}

type RunFn = (fn: () => Promise<unknown>, after?: () => void) => void
type Totals = ReturnType<typeof cartTotals>

// ── Next step ─────────────────────────────────────────────────────────────────

function NextStep({ p, run, pending, totals, pendingItems, canRecordPayments }: {
  p: ProjectDetail; run: RunFn; pending: boolean; totals: Totals; pendingItems: number; canRecordPayments: boolean
}) {
  const [callDate, setCallDate] = useState(p.first_call_at ? p.first_call_at.slice(0, 10) : '')
  const [proposalUrl, setProposalUrl] = useState(p.proposal_url ?? '')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  const decline = (
    declining ? (
      <div className={styles.inlineForm}>
        <input className={styles.formInput} placeholder="Why did they decline?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <button className={styles.dangerBtn} disabled={pending || !reason.trim()} onClick={() => run(() => rejectProposal(p.id, reason), () => setDeclining(false))}>Mark dormant</button>
        <button className={styles.linkBtn} onClick={() => setDeclining(false)}>Cancel</button>
      </div>
    ) : <button className={styles.linkBtn} onClick={() => setDeclining(true)}>They’re not going ahead</button>
  )

  let body: React.ReactNode = null
  switch (p.stage) {
    case 'lead':
      body = (
        <>
          <div className={styles.inlineForm}>
            <label className={styles.formLabelInline}>First call on</label>
            <input type="date" className={styles.formInputSm} value={callDate} onChange={(e) => setCallDate(e.target.value)} />
            <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => scheduleFirstCall(p.id, callDate || null))}>Schedule first call</button>
            <button className={styles.ghostBtn} disabled={pending} onClick={() => run(() => completeFirstCall(p.id))}>Call already done</button>
          </div>
          {decline}
        </>
      )
      break
    case 'first_call':
      body = (
        <>
          <div className={styles.inlineForm}>
            <span className={styles.muted}>{p.first_call_at ? `Call on ${fmtDate(p.first_call_at)}.` : 'No date set.'}</span>
            <input type="date" className={styles.formInputSm} value={callDate} onChange={(e) => setCallDate(e.target.value)} />
            <button className={styles.ghostBtn} disabled={pending} onClick={() => run(() => scheduleFirstCall(p.id, callDate || null))}>Change date</button>
            <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => completeFirstCall(p.id))}>Call done, build the proposal</button>
          </div>
          {decline}
        </>
      )
      break
    case 'proposal':
      body = (
        <>
          <Gates items={[
            { ok: p.services.length > 0, text: p.services.length ? `${p.services.length} service${p.services.length === 1 ? '' : 's'} in the cart, ${formatInr(totals.net)} + GST` : 'Add the services they want to the cart below' },
            { ok: !!p.proposal_sent_at, text: p.proposal_sent_at ? `Proposal sent ${fmtDate(p.proposal_sent_at)}` : 'Send the proposal' },
          ]} />
          {!p.proposal_sent_at ? (
            <div className={styles.inlineForm}>
              <input className={styles.formInput} placeholder="Proposal link (optional)" value={proposalUrl} onChange={(e) => setProposalUrl(e.target.value)} />
              <button className={styles.primaryBtn} disabled={pending || p.services.length === 0} onClick={() => run(() => markProposalSent(p.id, proposalUrl || null))}>Mark proposal sent</button>
            </div>
          ) : (
            <div className={styles.inlineForm}>
              <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => acceptProposal(p.id))}>Proposal accepted</button>
            </div>
          )}
          {decline}
        </>
      )
      break
    case 'data':
      body = (
        <>
          <Gates items={[
            { ok: pendingItems === 0, text: pendingItems === 0 ? 'Every data item is in, or marked not applicable' : `${pendingItems} data item${pendingItems === 1 ? '' : 's'} still outstanding` },
            { ok: !!p.drive_url, text: p.drive_url ? 'Google Drive folder linked' : 'Create the project folder in Google Drive and link it below' },
            { ok: !!p.advance_received_at, text: p.advance_received_at ? 'Advance received' : 'Advance not received yet (work starts once it is)', soft: true },
          ]} />
          <div className={styles.inlineForm}>
            <button className={styles.primaryBtn} disabled={pending || pendingItems > 0 || !p.drive_url} onClick={() => run(() => finishDataGathering(p.id))}>
              {p.advance_received_at ? 'Data complete, start work' : 'Data complete'}
            </button>
          </div>
        </>
      )
      break
    case 'advance':
      body = (
        <>
          <div className={styles.muted}>Data is in. Work starts once the 50% advance ({formatInr(totals.advanceGross)} with GST) is received.</div>
          {canRecordPayments
            ? <RecordPaymentForm kind="advance" expected={totals.advanceGross} p={p} run={run} pending={pending} />
            : <div className={styles.muted}>A founder, an admin or the project lead records it.</div>}
        </>
      )
      break
    case 'work': {
      const needsBalance = !p.balance_received_at && p.services.some((s) => ['draft_2', 'client_approved'].includes(s.step))
      body = (
        <div className={styles.muted}>
          Move each deliverable on below as drafts go out.
          {needsBalance && ' A draft is with the client, so the balance is due before the final.'}
        </div>
      )
      break
    }
    case 'handover':
      body = (
        <div className={styles.inlineForm}>
          <span className={styles.muted}>Walk them through the deliverables. Up to two changes after handover.</span>
          <button className={styles.primaryBtn} disabled={pending} onClick={() => run(() => completeProject(p.id))}>Complete project</button>
        </div>
      )
      break
    case 'completed':
      body = <div className={styles.muted}>Completed. Post-handover changes can still be logged below.</div>
      break
    case 'dormant':
      body = (
        <div className={styles.inlineForm}>
          <span className={styles.muted}>{p.rejection_reason ? `Declined: ${p.rejection_reason}` : 'Declined.'}</span>
          <button className={styles.ghostBtn} disabled={pending} onClick={() => run(() => reviveProject(p.id))}>They’re back, revive it</button>
        </div>
      )
      break
  }

  return (
    <section className={styles.nextStep}>
      <div className={styles.nextStepLabel}>Next step · {STAGE_META[p.stage].label}</div>
      <div className={styles.nextStepHint}>{STAGE_META[p.stage].hint}</div>
      {body}
    </section>
  )
}

function Gates({ items }: { items: Array<{ ok: boolean; text: string; soft?: boolean }> }) {
  return (
    <ul className={styles.gates}>
      {items.map((g) => (
        <li key={g.text} className={g.ok ? styles.gateOk : g.soft ? styles.gateSoft : styles.gateTodo}>
          <span className={styles.gateMark}>{g.ok ? '✓' : g.soft ? '·' : '○'}</span>{g.text}
        </li>
      ))}
    </ul>
  )
}

// ── Services cart ─────────────────────────────────────────────────────────────

function ServicesCart({ p, run, pending, totals }: { p: ProjectDetail; run: RunFn; pending: boolean; totals: Totals }) {
  const [adding, setAdding] = useState<ProjectService | ''>('')
  const [customLabel, setCustomLabel] = useState('')
  const [price, setPrice] = useState('')
  const present = new Set(p.services.map((s) => s.service))

  return (
    <>
      {p.services.length === 0 && <div className={styles.muted}>No services yet.</div>}
      <ul className={styles.cart}>
        {p.services.map((s) => (
          <li key={s.id} className={styles.cartRow}>
            <span className={styles.cartName}>{serviceLabel(s.service, s.label)}</span>
            {/* Keyed on the saved price, so a save elsewhere resets the draft without an effect. */}
            <PriceInput key={`${s.id}:${s.price_inr}`} value={s.price_inr} disabled={pending}
                        onSave={(v) => run(() => updateProjectService(s.id, { price_inr: v }))} />
            {s.step === 'not_started' && (
              <button className={styles.iconBtn} aria-label="Remove" disabled={pending} onClick={() => run(() => removeProjectService(s.id))}>✕</button>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.cartAdd}>
        <select className={styles.formInputSm} value={adding} onChange={(e) => setAdding(e.target.value as ProjectService | '')}>
          <option value="">+ Add a service…</option>
          {SERVICES.filter((s) => s === 'custom' || !present.has(s)).map((s) => <option key={s} value={s}>{SERVICE_META[s].label}</option>)}
        </select>
        {adding === 'custom' && (
          <input className={styles.formInputSm} placeholder="What is it?" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
        )}
        {adding && (
          <>
            <input className={styles.formInputSm} inputMode="numeric" placeholder="Price ₹ (optional)" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} style={{ width: '9rem' }} />
            <button className={styles.smallPrimaryBtn} disabled={pending || (adding === 'custom' && !customLabel.trim())}
                    onClick={() => run(() => addProjectService(p.id, adding, adding === 'custom' ? customLabel : null, price ? Number(price) : null),
                                       () => { setAdding(''); setCustomLabel(''); setPrice('') })}>
              Add
            </button>
          </>
        )}
      </div>

      {p.services.length > 0 && (
        <dl className={styles.totals}>
          <dt>Subtotal</dt><dd>{formatInr(totals.net)}</dd>
          <dt>GST 18%</dt><dd>{formatInr(totals.gst)}</dd>
          <dt className={styles.totalStrong}>Total</dt><dd className={styles.totalStrong}>{formatInr(totals.gross)}</dd>
          <dt>Advance 50%</dt><dd>{formatInr(totals.advanceGross)}</dd>
        </dl>
      )}
      {totals.unpriced > 0 && p.services.length > 0 && (
        <div className={styles.panelNote}>{totals.unpriced} service{totals.unpriced === 1 ? ' has' : 's have'} no price yet.</div>
      )}
    </>
  )
}

function PriceInput({ value, disabled, onSave }: { value: number | null; disabled: boolean; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const commit = () => {
    const v = draft.trim() === '' ? null : Number(draft)
    if (v === value || (v != null && !Number.isFinite(v))) return
    onSave(v)
  }
  return (
    <span className={styles.priceWrap}>
      <span className={styles.pricePrefix}>₹</span>
      <input className={styles.priceInput} inputMode="numeric" value={draft} disabled={disabled} placeholder="Price"
             onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
             onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </span>
  )
}

// ── Checklist ─────────────────────────────────────────────────────────────────

function Checklist({ p, run, pending }: { p: ProjectDetail; run: RunFn; pending: boolean }) {
  const [label, setLabel] = useState('')
  const groups = new Map<string, typeof p.checklist>()
  for (const item of p.checklist) {
    const key = item.service ?? 'other'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return (
    <>
      <div className={styles.checklistGroups}>
        {[...groups.entries()].map(([key, items]) => (
          <div key={key}>
            <div className={styles.checklistGroupTitle}>{key === 'other' ? 'Other' : `For the ${SERVICE_META[key as ProjectService].label.toLowerCase()}`}</div>
            <ul className={styles.checklist}>
              {items.map((i) => (
                <li key={i.id} className={`${styles.checkItem} ${styles[`check_${i.status}`]}`}>
                  <span className={styles.checkLabel}>
                    {i.label}{i.optional && <span className={styles.optionalTag}>optional</span>}
                  </span>
                  <span className={styles.checkButtons} role="group" aria-label="Status">
                    {(['pending', 'received', 'na'] as const).map((st) => (
                      <button key={st} disabled={pending} aria-pressed={i.status === st}
                              className={`${styles.checkBtn} ${i.status === st ? styles.checkBtnOn : ''}`}
                              onClick={() => i.status !== st && run(() => setChecklistStatus(i.id, st))}>
                        {st === 'pending' ? 'Pending' : st === 'received' ? 'Received' : 'N/A'}
                      </button>
                    ))}
                    <button className={styles.iconBtn} aria-label="Remove item" disabled={pending} onClick={() => run(() => removeChecklistItem(i.id))}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={styles.inlineForm}>
        <input className={styles.formInput} placeholder="Add something else you need from them" value={label} onChange={(e) => setLabel(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter' && label.trim()) run(() => addChecklistItem(p.id, label, null), () => setLabel('')) }} />
        <button className={styles.ghostBtn} disabled={pending || !label.trim()} onClick={() => run(() => addChecklistItem(p.id, label, null), () => setLabel(''))}>Add</button>
      </div>
    </>
  )
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentRow({ label, kind, expected, receivedAt, amount, p, run, pending, canRecord, canUndo }: {
  label: string; kind: 'advance' | 'balance'; expected: number; receivedAt: string | null; amount: number | null
  p: ProjectDetail; run: RunFn; pending: boolean; canRecord: boolean; canUndo: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.paymentRow}>
      <div className={styles.paymentHead}>
        <span className={styles.paymentLabel}>{label}</span>
        <span className={receivedAt ? styles.paid : styles.unpaid}>
          {receivedAt ? `Received ${fmtDate(receivedAt)}${amount != null ? ` · ${formatInr(amount)}` : ''}` : `Expected ${formatInr(expected)}`}
        </span>
      </div>
      {receivedAt
        ? canUndo && <button className={styles.linkBtn} disabled={pending} onClick={() => run(() => clearPayment(p.id, kind))}>Undo</button>
        : canRecord && (open
          ? <RecordPaymentForm kind={kind} expected={expected} p={p} run={run} pending={pending} onDone={() => setOpen(false)} />
          : <button className={styles.linkBtn} onClick={() => setOpen(true)}>Record payment</button>)}
    </div>
  )
}

function RecordPaymentForm({ kind, expected, p, run, pending, onDone }: {
  kind: 'advance' | 'balance'; expected: number; p: ProjectDetail; run: RunFn; pending: boolean; onDone?: () => void
}) {
  const [amount, setAmount] = useState(expected ? String(expected) : '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  return (
    <div className={styles.inlineForm}>
      <span className={styles.pricePrefix}>₹</span>
      <input className={styles.formInputSm} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Amount" style={{ width: '9rem' }} />
      <input type="date" className={styles.formInputSm} value={date} onChange={(e) => setDate(e.target.value)} />
      <button className={styles.smallPrimaryBtn} disabled={pending}
              onClick={() => run(() => recordPayment(p.id, kind, amount ? Number(amount) : null, date || null), onDone)}>
        Record {kind}
      </button>
    </div>
  )
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function LinkField({ label, value, placeholder, pending, onSave }: {
  label: string; value: string | null; placeholder: string; pending: boolean; onSave: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  return (
    <div className={styles.linkField}>
      <div className={styles.linkFieldLabel}>{label}</div>
      {editing ? (
        <div className={styles.inlineForm}>
          <input className={styles.formInput} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button className={styles.smallPrimaryBtn} disabled={pending} onClick={() => { onSave(draft || null); setEditing(false) }}>Save</button>
          <button className={styles.linkBtn} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className={styles.inlineForm}>
          {value ? <a href={value} target="_blank" rel="noreferrer" className={styles.linkValue}>{value}</a> : <span className={styles.muted}>Not linked</span>}
          <button className={styles.linkBtn} onClick={() => { setDraft(value ?? ''); setEditing(true) }}>{value ? 'Change' : 'Add'}</button>
        </div>
      )}
    </div>
  )
}

function ChangeRequest({ p, run, pending }: { p: ProjectDetail; run: RunFn; pending: boolean }) {
  const [note, setNote] = useState('')
  const changes = p.events.filter((e) => e.kind === 'change')
  return (
    <>
      {changes.length > 0 && (
        <ul className={styles.changeList}>{changes.map((c) => <li key={c.id}>{c.body} <span className={styles.muted}>· {fmtShort(c.created_at)}</span></li>)}</ul>
      )}
      {p.changes_used < 2 ? (
        <div className={styles.inlineForm}>
          <input className={styles.formInput} placeholder="What did they ask to change?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={styles.ghostBtn} disabled={pending || !note.trim()} onClick={() => run(() => logChangeRequest(p.id, note), () => setNote(''))}>Log change</button>
        </div>
      ) : (
        <div className={styles.panelNote}>Both changes used. Anything further is a new engagement.</div>
      )}
    </>
  )
}

function NoteInput({ pending, onAdd }: { pending: boolean; onAdd: (body: string) => void }) {
  const [body, setBody] = useState('')
  return (
    <div className={styles.inlineForm}>
      <input className={styles.formInput} placeholder="Add a note to the timeline" value={body} onChange={(e) => setBody(e.target.value)}
             onKeyDown={(e) => { if (e.key === 'Enter' && body.trim()) { onAdd(body); setBody('') } }} />
      <button className={styles.ghostBtn} disabled={pending || !body.trim()} onClick={() => { onAdd(body); setBody('') }}>Add</button>
    </div>
  )
}

function ClientLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button className={styles.ghostBtn} title="A read-only status page for the client" onClick={async () => {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/pr/${token}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      } catch { window.open(`/pr/${token}`, '_blank') }
    }}>
      {copied ? 'Copied' : 'Copy client link'}
    </button>
  )
}

function AdminTools({ p, run, pending, onDeleted }: { p: ProjectDetail; run: RunFn; pending: boolean; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={styles.adminTools}>
      <span className={styles.muted}>Founder/admin:</span>
      <label className={styles.formLabelInline}>Set stage</label>
      <select className={styles.formInputSm} value={p.stage} disabled={pending} onChange={(e) => run(() => overrideStage(p.id, e.target.value as ProjectStage))}>
        {[...PROJECT_STAGES, 'dormant' as const].map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
      </select>
      {confirming ? (
        <>
          <span className={styles.muted}>Delete this project and its tasks?</span>
          <button className={styles.dangerBtn} disabled={pending} onClick={() => run(() => deleteProject(p.id), onDeleted)}>Delete</button>
          <button className={styles.linkBtn} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button className={styles.linkBtn} onClick={() => setConfirming(true)}>Delete project</button>
      )}
    </div>
  )
}
