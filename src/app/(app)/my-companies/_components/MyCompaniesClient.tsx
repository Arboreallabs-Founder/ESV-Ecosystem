'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import { getOrCreateMyReferralLink, submitCompanyToPipeline } from '@/app/actions/partner-companies'
import { SGP_INTAKE_ACTION_LABELS } from '@/lib/types'
import type { UserRow } from '@/lib/types'
import type { PartnerSubmission } from '@/lib/partner-companies'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../my-companies.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

/* Stage colour by type, not by name — an org can rename a stage and this should keep working. */
function stageClass(t: string | undefined) {
  if (t === 'accepted') return 'statusAssigned'
  if (t === 'rejected') return 'statusClosed'
  if (t === 'lead') return 'statusSubmitted'
  return 'statusAssigned'
}


export default function MyCompaniesClient({
  submissions, coordinators, stages, pipelineReady, formReady, myLinkToken,
}: {
  formReady: boolean
  myLinkToken: string | null
  submissions: PartnerSubmission[]
  stages: Array<{ id: string; name: string; stage_type: string; color: string | null }>
  pipelineReady: boolean
  coordinators: UserRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(myLinkToken)
  const [copied, setCopied] = useState(false)
  const [linkPending, startLink] = useTransition()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the link is on screen either way */ }
  }
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget
    setError(null); setSaved(null)

    startTransition(async () => {
      try {
        await submitCompanyToPipeline({
          name: fd.get('name') as string,
          website: fd.get('website') as string,
          sector: fd.get('sector') as string,
          hq_city: fd.get('hq_city') as string,
          contact_name: fd.get('contact_name') as string,
          contact_email: fd.get('contact_email') as string,
          contact_phone: fd.get('contact_phone') as string,
          notes: fd.get('partner_comments') as string,
        })
        form.reset()
        setOpen(false)
        setSaved(fd.get('name') as string)
        router.refresh()
        setTimeout(() => setSaved(null), 4000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.pageTitle}>My Companies</h1>
            <WikiButton sectionKey="myCompanies" />
          </div>
          <p className={styles.pageSub}>
            Companies you&apos;ve brought in. Add one with your notes and it goes to the SGP
            Coordinator, who decides what happens next.
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={() => { setOpen((v) => !v); setError(null) }}>
          {open ? 'Cancel' : '+ Add a company'}
        </button>
      </header>

      {coordinators.length > 0 && (
        <p className={styles.coordinators}>
          Goes to{' '}
          {coordinators.map((c, i) => (
            <span key={c.id} className={styles.coordinator}>
              <Avatar name={c.name} photoUrl={c.photo_url} size="xs" />
              {c.name || c.email}{i < coordinators.length - 1 ? ',' : ''}
            </span>
          ))}
        </p>
      )}

      {saved && (
        <div className={styles.success}>
          <strong>{saved}</strong> submitted. You&apos;ll see its status change here as it&apos;s
          picked up.
        </div>
      )}

      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Only the name is required — the point is to capture a company while it's in front of
              you, not to make you fill in a form before you can tell us about it. */}
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Company name *</span>
              <input className={styles.input} name="name" required autoFocus placeholder="What are they called?" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Website</span>
              <input className={styles.input} name="website" placeholder="https://…" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Sector</span>
              <input className={styles.input} name="sector" placeholder="e.g. Fintech" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>City</span>
              <input className={styles.input} name="hq_city" placeholder="e.g. Mumbai" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contact name</span>
              <input className={styles.input} name="contact_name" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contact email</span>
              <input className={styles.input} type="email" name="contact_email" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contact phone</span>
              <input className={styles.input} name="contact_phone" />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Your comments</span>
              <textarea
                className={styles.textarea}
                name="partner_comments"
                rows={4}
                placeholder="How you know them, why they're interesting, what stage they're at, anything the team should know before reaching out."
              />
              <span className={styles.hint}>
                This is passed to whoever picks it up — it&apos;s the most useful part of the form.
              </span>
            </label>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn} disabled={isPending}>
              {isPending ? 'Submitting…' : 'Submit company'}
            </button>
          </div>
        </form>
      )}

      {/* The partner's own link. One per partner, always on the partner form, so a referral that
          arrives this way lands in the same queue as one they type in themselves — and is
          attributed to them without anyone having to remember to do it. */}
      {formReady && (
        <div className={styles.linkBlock}>
          <div>
            <div className={styles.linkTitle}>Your referral link</div>
            <div className={styles.linkSub}>
              Send this to a company and they can submit themselves. It arrives here credited to
              you, exactly like one you add above.
            </div>
          </div>
          {token ? (
            <div className={styles.linkRow}>
              <code className={styles.linkBox}>{`${origin}/f/${token}`}</code>
              <button className={styles.linkBtn} onClick={() => copy(`${origin}/f/${token}`)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <button
              className={styles.linkBtn}
              disabled={linkPending}
              onClick={() => startLink(async () => {
                try { setToken((await getOrCreateMyReferralLink()).token) }
                catch (err) { alertError(err) }
              })}
            >
              {linkPending ? 'Creating…' : 'Get my link'}
            </button>
          )}
        </div>
      )}

      {submissions.length === 0 ? (
        <div className={styles.empty}>
          You haven&apos;t added a company yet. Anything you add here is attributed to you and
          tracked through to whoever works on it.
        </div>
      ) : (
        <div className={styles.list}>
          {submissions.map((s) => (
            <article key={s.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardName}>{s.title ?? 'Untitled'}</h2>
                  <div className={styles.cardMeta}>
                    added {formatDateTimeIst(s.submitted_at)}
                  </div>
                </div>
                {/* The live stage, straight off the entry. When a coordinator moves the card on
                    the board, this moves with it — there is no second status to fall behind. */}
                <span className={`${styles.status} ${styles[stageClass(s.stage?.stage_type)]}`}>
                  {s.stage?.name ?? 'Submitted'}
                </span>
              </div>

              {s.partner_notes && <p className={styles.comments}>{s.partner_notes}</p>}

              {/* Where it sits in the run of stages, so "First level call" means something to
                  somebody who has never seen the board. */}
              {stages.length > 0 && s.stage && s.stage.stage_type !== 'rejected' && (
                <div className={styles.progress}>
                  {stages
                    .filter((st) => st.stage_type !== 'rejected')
                    .map((st) => {
                      const here = st.name === s.stage!.name
                      const idx = stages.findIndex((x) => x.name === s.stage!.name)
                      const done = stages.findIndex((x) => x.name === st.name) < idx
                      return (
                        <span
                          key={st.id}
                          className={here ? styles.stepNow : done ? styles.stepDone : styles.step}
                          title={st.name}
                        >
                          {st.name}
                        </span>
                      )
                    })}
                </div>
              )}

              {s.stage?.stage_type === 'rejected' && (
                <div className={styles.closed}>
                  {s.rejection_reason || 'Not taken forward.'}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
