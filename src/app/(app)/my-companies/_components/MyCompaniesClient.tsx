'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitPartnerCompany } from '@/app/actions/partner-companies'
import { SGP_INTAKE_ACTION_LABELS } from '@/lib/types'
import type { PartnerCompany, UserRow } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../my-companies.module.css'

const STATUS_META: Record<PartnerCompany['status'], { label: string; className: string; hint: string }> = {
  submitted: { label: 'With the coordinator', className: 'statusSubmitted', hint: 'Waiting to be picked up.' },
  assigned: { label: 'Being worked on', className: 'statusAssigned', hint: 'Someone has been assigned to it.' },
  closed: { label: 'Closed', className: 'statusClosed', hint: '' },
}

export default function MyCompaniesClient({
  submissions, coordinators,
}: {
  submissions: PartnerCompany[]
  coordinators: UserRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
        await submitPartnerCompany({
          name: fd.get('name') as string,
          website: fd.get('website') as string,
          sector: fd.get('sector') as string,
          hq_city: fd.get('hq_city') as string,
          contact_name: fd.get('contact_name') as string,
          contact_email: fd.get('contact_email') as string,
          contact_phone: fd.get('contact_phone') as string,
          partner_comments: fd.get('partner_comments') as string,
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
          <h1 className={styles.pageTitle}>My Companies</h1>
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

      {submissions.length === 0 ? (
        <div className={styles.empty}>
          You haven&apos;t added a company yet. Anything you add here is attributed to you and
          tracked through to whoever works on it.
        </div>
      ) : (
        <div className={styles.list}>
          {submissions.map((s) => {
            const meta = STATUS_META[s.status]
            return (
              <article key={s.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h2 className={styles.cardName}>{s.name}</h2>
                    <div className={styles.cardMeta}>
                      {[s.sector, s.hq_city].filter(Boolean).join(' · ') || 'No sector given'}
                      {' · added '}{formatDateTimeIst(s.created_at)}
                    </div>
                  </div>
                  <span className={`${styles.status} ${styles[meta.className]}`}>{meta.label}</span>
                </div>

                {s.partner_comments && <p className={styles.comments}>{s.partner_comments}</p>}

                {/* Partners see that it moved and who has it — not the internal notes or links. */}
                {s.status === 'assigned' && (
                  <div className={styles.progress}>
                    <span className={styles.progressAction}>
                      {s.intake_action ? SGP_INTAKE_ACTION_LABELS[s.intake_action] : 'In progress'}
                    </span>
                    {s.assignee?.name && (
                      <span className={styles.progressWho}>
                        <Avatar name={s.assignee.name} photoUrl={s.assignee.photo_url} size="xs" />
                        {s.assignee.name}
                      </span>
                    )}
                  </div>
                )}

                {s.status === 'closed' && (
                  <div className={styles.closed}>
                    {s.closed_reason || 'Closed without a reason given.'}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
