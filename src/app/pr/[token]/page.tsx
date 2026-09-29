import { createClient } from '@/lib/supabase/server'
import PhaseBar from '@/app/_components/PhaseBar'
import Avatar from '@/app/_components/Avatar'
import { STAGE_META, SERVICE_META, trackFor, type ProjectService, type ProjectStage, type TrackStep } from '@/lib/project-model'
import styles from './project-public.module.css'

type PublicProject = {
  name: string
  company: string | null
  logo_url: string | null
  stage: ProjectStage
  stage_changed_at: string
  work_started_at: string | null
  advance_received: boolean
  balance_received: boolean
  changes_used: number
  /** The Google Drive project folder, once the team has made it (20261015000000). */
  drive_url?: string | null
  services: Array<{ service: ProjectService; label: string; step: TrackStep }>
  checklist: Array<{ label: string; service: ProjectService | null; status: 'pending' | 'received' | 'na'; optional: boolean }>
  contact: { name: string | null; email: string | null; photo_url: string | null } | null
}

/** What the client sees: where the engagement is, each deliverable's progress, and what we still
    need from them. No account; the token is the key and get_project_public decides what it buys.
    Client-facing copy, so no em dashes. */
const CLIENT_STAGE_TEXT: Record<ProjectStage, string> = {
  lead: 'We are setting up an introductory call.',
  first_call: 'We have an introductory call scheduled.',
  proposal: 'We are preparing your proposal.',
  data: 'We are collecting the information we need to begin.',
  advance: 'Everything is in. Work begins once the advance payment is received.',
  work: 'Work is under way.',
  handover: 'Your deliverables are ready and being handed over.',
  completed: 'This engagement is complete. Thank you for working with us.',
  dormant: 'This engagement is on hold.',
}

export default async function ProjectPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_project_public', { p_token: token })
  const p = data as PublicProject | null

  if (!p) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static, already-small asset */}
          <img src="/brand/esv-logo.png" alt="Earlyseed Ventures" className={styles.logo} />
          <h1 className={styles.title}>Link not available</h1>
          <p className={styles.sub}>We don’t recognise this link. Ask your Earlyseed Ventures contact for a current one.</p>
        </div>
      </div>
    )
  }

  const outstanding = p.checklist.filter((i) => i.status === 'pending')
  const showData = ['data', 'advance'].includes(p.stage) && p.checklist.length > 0
  const showTracks = ['work', 'handover', 'completed'].includes(p.stage) && p.services.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static, already-small asset */}
        <img src="/brand/esv-logo.png" alt="Earlyseed Ventures" className={styles.logo} />
        <div className={styles.eyebrow}>Project status</div>
        <h1 className={styles.title}>{p.company ?? p.name}</h1>
        {p.services.length > 0 && (
          <div className={styles.services}>{p.services.map((s) => s.label).join(' · ')}</div>
        )}

        {p.drive_url && (
          <a href={p.drive_url} target="_blank" rel="noreferrer" className={styles.driveBtn}>
            Open your project folder on Google Drive ↗
          </a>
        )}

        <div className={styles.section}>
          <PhaseBar stage={p.stage} variant="detailed" />
          <p className={styles.stageText}><strong>{STAGE_META[p.stage].label}.</strong> {CLIENT_STAGE_TEXT[p.stage]}</p>
        </div>

        {showData && (
          <div className={styles.section}>
            <h2 className={styles.h2}>What we still need from you</h2>
            {outstanding.length === 0 ? (
              <p className={styles.muted}>Nothing. We have everything, thank you.</p>
            ) : (
              <ul className={styles.checklist}>
                {outstanding.map((i) => (
                  <li key={i.label}>
                    {i.label}{i.optional && <span className={styles.optional}> (if available)</span>}
                  </li>
                ))}
              </ul>
            )}
            {p.drive_url && outstanding.length > 0 && (
              <p className={styles.muted}>
                Please upload these to your <a href={p.drive_url} target="_blank" rel="noreferrer" className={styles.inlineLink}>project folder</a>.
              </p>
            )}
            <p className={styles.muted}>
              {p.checklist.length - outstanding.length} of {p.checklist.length} items received.
              If something doesn’t apply to you, just let us know and we’ll mark it.
            </p>
          </div>
        )}

        {showTracks && (
          <div className={styles.section}>
            <h2 className={styles.h2}>Deliverables</h2>
            {p.services.map((s) => {
              const track = trackFor(s.service)
              return (
                <div key={s.label} className={styles.track}>
                  <div className={styles.trackName}>{s.label || SERVICE_META[s.service].label}</div>
                  <PhaseBar stage={s.step as ProjectStage} variant="detailed" steps={track.map((t) => ({ key: t.step, label: t.label }))} />
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.h2}>Payments</h2>
          <ul className={styles.payments}>
            <li><span>Advance (50%)</span><span className={p.advance_received ? styles.paid : styles.due}>{p.advance_received ? 'Received' : 'Pending'}</span></li>
            <li><span>Balance (50%)</span><span className={p.balance_received ? styles.paid : styles.due}>{p.balance_received ? 'Received' : 'Due before the final handover'}</span></li>
          </ul>
          {(p.stage === 'handover' || p.stage === 'completed') && (
            <p className={styles.muted}>Changes after handover: {p.changes_used} of 2 used.</p>
          )}
        </div>

        {p.contact && (
          <div className={styles.contact}>
            <Avatar name={p.contact.name} email={p.contact.email} photoUrl={p.contact.photo_url} size="md" />
            <div>
              <div className={styles.contactName}>{p.contact.name}</div>
              {p.contact.email && <a href={`mailto:${p.contact.email}`} className={styles.contactEmail}>{p.contact.email}</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
