'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateFormLink, deleteFormLink } from '@/app/actions/forms'
import type { ShareLink, ShareableForm } from '@/lib/share-links'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../share.module.css'

export default function ShareClient({
  forms, links, canSeeAll, scope, currentUserId,
}: {
  forms: ShareableForm[]
  links: ShareLink[]
  canSeeAll: boolean
  scope: 'mine' | 'all'
  currentUserId: string
}) {
  const router = useRouter()
  const [formId, setFormId] = useState(forms.find((f) => f.published)?.id ?? '')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [justMade, setJustMade] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState<ShareLink | null>(null)
  const [isPending, startTransition] = useTransition()

  const published = useMemo(() => forms.filter((f) => f.published), [forms])
  // Drafts with links already out are the trap worth naming: those links are dead until someone
  // republishes, and nothing else in the app says so.
  const deadDrafts = useMemo(
    () => forms.filter((f) => !f.published && f.linkCount > 0),
    [forms],
  )

  const selected = forms.find((f) => f.id === formId) ?? null

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setJustMade(null)
    if (!formId) { setError('Choose a form first.'); return }

    startTransition(async () => {
      try {
        const result = await generateFormLink(formId, label)
        setJustMade(result.token)
        setLabel('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600)
    } catch (err) { setError(String(err)) }
  }

  function handleDelete(link: ShareLink) {
    if (!confirm(
      `Delete this link?\n\nAnyone who already has it will get an error, and the ${link.stats.submissions} `
      + 'submission(s) it produced stay in the pipeline but lose their attribution to it.',
    )) return
    startTransition(async () => {
      try { await deleteFormLink(link.id); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    })
  }

  function downloadQr(link: ShareLink) {
    const a = document.createElement('a')
    a.href = link.qr
    a.download = `${(link.label || link.form?.title || 'share-link').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.png`
    a.click()
  }

  return (
    <div className={styles.pane}>
      <header className={styles.paneHead}>
        <p className={styles.pageSub}>
          Issue your own link to an intake form, share it as a URL or QR code, and see what it
          brought in.
        </p>
        {canSeeAll && (
          <div className={styles.scopeToggle}>
            <button
              className={`${styles.scopeBtn} ${scope === 'mine' ? styles.scopeBtnActive : ''}`}
              onClick={() => router.push('/forms?tab=share')}
            >
              My links
            </button>
            <button
              className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeBtnActive : ''}`}
              onClick={() => router.push('/forms?tab=share&scope=all')}
            >
              Everyone&apos;s
            </button>
          </div>
        )}
      </header>

      {deadDrafts.length > 0 && (
        <div className={styles.warning}>
          <strong>
            {deadDrafts.length === 1 ? 'One form is' : `${deadDrafts.length} forms are`} a draft with
            links already shared.
          </strong>{' '}
          Links to a draft return an error until the form is published —{' '}
          {deadDrafts.map((f) => `${f.title} (${f.linkCount})`).join(', ')}.
        </div>
      )}

      {/* ── Issue ── */}
      <form className={styles.issueCard} onSubmit={handleGenerate}>
        <div className={styles.issueGrid}>
          {/* Each cell is label + control and nothing else, so all three line up on both edges.
              Hints live below the grid — put one inside a cell and it makes that column taller,
              which pushes its label out of line with the others. */}
          <label className={styles.field}>
            <span className={styles.label}>Form</span>
            <select
              className={styles.input}
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              disabled={published.length === 0}
            >
              {published.length === 0 && <option value="">No published forms available</option>}
              {published.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}{f.pipelineName ? ` → ${f.pipelineName}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Label <span className={styles.optional}>optional</span></span>
            <input
              className={styles.input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. TiE Mumbai, Nov cohort"
            />
          </label>
          <button type="submit" className={styles.issueBtn} disabled={isPending || !formId}>
            {isPending ? 'Creating…' : 'Create my link'}
          </button>
        </div>

        {published.length === 0 ? (
          /* Distinguish "nothing exists" from "everything is still a draft" — the second is one
             click from being fixed, and saying so is more use than an empty dropdown. */
          <p className={styles.issueNote}>
            {forms.length > 0
              ? <>All {forms.length} form{forms.length !== 1 ? 's are' : ' is'} still a draft, so there is nothing to share yet. Publish one from the <Link href="/forms" className={styles.inlineLink}>Forms</Link> tab.</>
              : <>No intake forms exist yet. Build one from the <Link href="/forms" className={styles.inlineLink}>Forms</Link> tab first.</>}
          </p>
        ) : (
          <p className={styles.issueNote}>
            The label is only visible to you — it&apos;s how you tell your own links apart.
          </p>
        )}

        {selected && !selected.published && (
          <div className={styles.inlineWarn}>
            {selected.title} is a draft — a link you make now won&apos;t work until it&apos;s published.
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </form>

      {/* ── Links ── */}
      {links.length === 0 ? (
        <div className={styles.empty}>
          {scope === 'mine'
            ? "You haven't created a link yet. Pick a form above and create one — it's yours, and anything submitted through it is attributed to you."
            : 'No links have been issued yet.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {links.map((l) => (
            <article key={l.id} className={`${styles.card} ${l.token === justMade ? styles.cardNew : ''}`}>
              <div className={styles.cardHead}>
                <div className={styles.cardWho}>
                  <div className={styles.cardLabel}>{l.label || 'Untitled link'}</div>
                  <div className={styles.cardForm}>
                    {l.form?.title ?? 'Form deleted'}
                    {l.form && !l.form.published && <span className={styles.draftTag}>Draft — inactive</span>}
                  </div>
                </div>
                {scope === 'all' && l.creator && (
                  <span className={styles.cardCreator} title={l.creator.name ?? ''}>
                    <Avatar name={l.creator.name} size="sm" />
                  </span>
                )}
              </div>

              <div className={styles.qrRow}>
                <button
                  type="button"
                  className={styles.qrBtn}
                  onClick={() => setZoomed(l)}
                  title="Enlarge"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.qr} alt={`QR code for ${l.label || l.form?.title || 'link'}`} />
                </button>

                <dl className={styles.stats}>
                  <div className={styles.stat}>
                    <dt>Submissions</dt>
                    <dd className={styles.statBig}>{l.stats.submissions}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>Accepted</dt>
                    <dd className={l.stats.accepted > 0 ? styles.statGood : undefined}>{l.stats.accepted}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>In review</dt>
                    <dd>{l.stats.inReview}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>Rejected</dt>
                    <dd>{l.stats.rejected}</dd>
                  </div>
                </dl>
              </div>

              <div className={styles.urlRow}>
                <code className={styles.url}>{l.url}</code>
                <button type="button" className={styles.copyBtn} onClick={() => copy(l.url, l.id)}>
                  {copied === l.id ? 'Copied ✓' : 'Copy'}
                </button>
              </div>

              <div className={styles.cardFoot}>
                <span className={styles.meta}>
                  Created {formatDateTimeIst(l.created_at)}
                  {l.stats.lastSubmissionAt
                    ? ` · last submission ${formatDateTimeIst(l.stats.lastSubmissionAt)}`
                    : ' · no submissions yet'}
                </span>
                <span className={styles.footActions}>
                  <button type="button" className={styles.ghostBtn} onClick={() => downloadQr(l)}>
                    Download QR
                  </button>
                  {(l.creator?.id === currentUserId || canSeeAll) && (
                    <button type="button" className={styles.dangerBtn} onClick={() => handleDelete(l)} disabled={isPending}>
                      Delete
                    </button>
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Enlarged QR — what you point a phone camera at across a table. */}
      {zoomed && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setZoomed(null)}>
          <div className={styles.qrModal} onMouseDown={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomed.qr} alt="" className={styles.qrLarge} />
            <div className={styles.qrModalLabel}>{zoomed.label || zoomed.form?.title}</div>
            <code className={styles.qrModalUrl}>{zoomed.url}</code>
            <div className={styles.qrModalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setZoomed(null)}>Close</button>
              <button type="button" className={styles.copyBtn} onClick={() => downloadQr(zoomed)}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
