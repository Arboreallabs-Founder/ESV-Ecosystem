'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import { updateCompanyShareIntro } from '@/app/actions/active-deal-documents'
import { buildDealPitch, hasShareableDocuments, whatsappLink, SHARE_INTRO_MAX } from '@/lib/deal-pitch'
import type { ActiveDealDocument } from '@/lib/types'
import styles from '../active-deals.module.css'

/**
 * Send a deal on.
 *
 * Partners and associates were retyping the same paragraph into WhatsApp with whichever links they
 * could find, which is how a message goes out with last month's deck attached. This builds it from
 * what is actually on the deal — and only from the documents marked shared, because the message
 * leaves the app.
 *
 * The preview is not decoration: this is the one action here whose output someone else reads, and
 * sending it blind is how a wrong link gets forwarded to forty people.
 */
export default function SharePitch({
  companyName, intro, documents, compact = false, companyId, canEditIntro = false,
}: {
  companyName: string
  intro?: string | null
  documents: ActiveDealDocument[]
  /** On a card, where there is room for an icon and not much else. */
  compact?: boolean
  /** The linked company profile. Without one there is nowhere to save an introduction to. */
  companyId?: string | null
  canEditIntro?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Edited here because this is where anyone notices it is wrong. A field only reachable from an
  // edit form three clicks away is a field that stays as the one-liner forever.
  const [draft, setDraft] = useState(intro ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, startSave] = useTransition()

  const message = buildDealPitch({ companyName, intro: editing ? draft : intro, documents })
  const shareable = hasShareableDocuments(documents)

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the text is on screen either way */
    }
  }

  return (
    <>
      <button
        type="button"
        className={compact ? styles.shareChip : styles.shareBtn}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title={shareable
          ? 'Share this deal on WhatsApp'
          : 'Share this deal — no documents shared yet, so the message will carry the intro only'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
        </svg>
        {!compact && 'Share on WhatsApp'}
      </button>

      {open && (
        // onMouseDown, not onClick: a drag that starts inside the preview and ends on the backdrop
        // should not close it — selecting a line of the message does exactly that.
        <div className={styles.shareBackdrop} onMouseDown={() => setOpen(false)} role="presentation">
          <div className={styles.shareModal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Share this deal">
            <div className={styles.shareHead}>
              <div className={styles.shareTitle}>Share {companyName}</div>
              <button className={styles.shareClose} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <p className={styles.shareNote}>
              {shareable
                ? 'Only documents marked Shared are included — this message leaves the app.'
                : 'No documents are shared on this deal yet, so the message carries the introduction only.'}
            </p>

            {canEditIntro && companyId && (
              <div className={styles.shareIntro}>
                {editing ? (
                  <>
                    <textarea
                      className={styles.shareIntroBox}
                      value={draft}
                      maxLength={SHARE_INTRO_MAX}
                      rows={3}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="What they do and why it is worth opening the deck."
                    />
                    <div className={styles.shareIntroFoot}>
                      <span className={styles.shareIntroCount}>{draft.length}/{SHARE_INTRO_MAX}</span>
                      <button className={styles.shareGhost} onClick={() => { setDraft(intro ?? ''); setEditing(false) }}>
                        Cancel
                      </button>
                      <button
                        className={styles.shareGhost}
                        disabled={saving}
                        onClick={() => startSave(async () => {
                          try {
                            // Saved to the company, not the deal: the same company can be on two
                            // deals and its pitch does not change between them.
                            await updateCompanyShareIntro(companyId, draft)
                            setEditing(false)
                            router.refresh()
                          } catch (err) { alertError(err) }
                        })}
                      >
                        {saving ? 'Saving…' : 'Save introduction'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button className={styles.shareIntroEdit} onClick={() => { setDraft(intro ?? ''); setEditing(true) }}>
                    {intro?.trim() ? 'Edit the introduction' : 'Write an introduction'}
                  </button>
                )}
              </div>
            )}

            <pre className={styles.sharePreview}>{message}</pre>

            <div className={styles.shareActions}>
              <button className={styles.shareGhost} onClick={copy}>
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <a
                className={styles.sharePrimary}
                href={whatsappLink(message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                Open in WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
