'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  addDealDocument, deleteDealDocument, setDealDocumentPartnerVisibility,
} from '@/app/actions/active-deal-documents'
import {
  DEAL_DOCUMENT_KINDS, DEAL_DOCUMENT_LABELS, DEAL_DOCUMENT_SHORT,
  type ActiveDealDocument, type DealDocumentKind,
} from '@/lib/types'
import SharePitch from './SharePitch'
import styles from '../active-deals.module.css'

/**
 * The documents on a deal.
 *
 * Five fixed slots — IM, financials, deck, MIS, data room — because the point is that everyone
 * looks in the same place for the same thing. More than one of a kind is allowed and expected: a
 * deal has several MIS months and more than one version of a deck.
 *
 * Grouped by kind rather than listed by date, so "where is the deck" is answered by looking at the
 * row called Deck instead of scanning a feed.
 */
export default function DealDocuments({
  dealId, documents, canEdit, isPartner, companyName, intro, canShare,
}: {
  dealId: string
  documents: ActiveDealDocument[]
  canEdit: boolean
  isPartner: boolean
  companyName: string
  intro?: string | null
  canShare: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState<DealDocumentKind | null>(null)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [shared, setShared] = useState(true)
  const [pending, start] = useTransition()

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setAdding(null)
        setUrl('')
        setLabel('')
        setShared(true)
        router.refresh()
      } catch (err) {
        alertError(err)
      }
    })
  }

  const byKind = (kind: DealDocumentKind) => documents.filter((d) => d.kind === kind)

  // A partner sees only the kinds that actually have something shared. An empty row labelled
  // "Data Room" tells them a data room exists and they cannot have it, which is worse than silence.
  const kinds = isPartner
    ? DEAL_DOCUMENT_KINDS.filter((k) => byKind(k).length > 0)
    : DEAL_DOCUMENT_KINDS

  if (isPartner && kinds.length === 0) return null

  return (
    <div className={styles.dashCard}>
      <div className={styles.detailSectionHead}>
        <div className={styles.detailSectionTitle}>Documents</div>
        <div className={styles.docHeadRight}>
          {!isPartner && (
            <span className={styles.docHint}>Links, not uploads — the file stays where it is edited.</span>
          )}
          {canShare && <SharePitch companyName={companyName} intro={intro} documents={documents} />}
        </div>
      </div>

      <div className={styles.docList}>
        {kinds.map((kind) => {
          const docs = byKind(kind)
          return (
            <div key={kind} className={styles.docGroup}>
              <div className={styles.docGroupHead}>
                <span className={styles.docKind}>{DEAL_DOCUMENT_LABELS[kind]}</span>
                {canEdit && (
                  <button
                    className={styles.docAdd}
                    onClick={() => { setAdding(adding === kind ? null : kind); setUrl(''); setLabel('') }}
                  >
                    {adding === kind ? 'Cancel' : docs.length === 0 ? '+ Add' : '+ Add another'}
                  </button>
                )}
              </div>

              {docs.length === 0 && adding !== kind && (
                <div className={styles.docEmpty}>Nothing linked yet.</div>
              )}

              {docs.map((doc) => (
                <div key={doc.id} className={styles.docRow}>
                  <a className={styles.docLink} href={doc.url} target="_blank" rel="noopener noreferrer">
                    {doc.label || DEAL_DOCUMENT_SHORT[kind]}
                    <span className={styles.docHost}>{hostOf(doc.url)}</span>
                  </a>
                  {canEdit && (
                    <>
                      {/* Per document, so a deal can share its deck and hold back one MIS month. */}
                      <button
                        className={doc.visible_to_partners ? styles.docShared : styles.docPrivate}
                        disabled={pending}
                        title={doc.visible_to_partners
                          ? 'Partners can open this. Click to withhold it.'
                          : 'Withheld from partners. Click to share it.'}
                        onClick={() => run(() => setDealDocumentPartnerVisibility(doc.id, !doc.visible_to_partners))}
                      >
                        {doc.visible_to_partners ? 'Shared' : 'Internal'}
                      </button>
                      <button
                        className={styles.docRemove}
                        disabled={pending}
                        title="Remove this link"
                        onClick={() => {
                          if (!confirm(`Remove this ${DEAL_DOCUMENT_SHORT[kind]} link?`)) return
                          run(() => deleteDealDocument(doc.id))
                        }}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}

              {adding === kind && (
                <div className={styles.docForm}>
                  <input
                    className={styles.docInput}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    autoFocus
                  />
                  <input
                    className={styles.docInputSmall}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={docs.length === 0 ? 'Label (optional)' : 'e.g. July, v3'}
                  />
                  <label className={styles.docShareToggle}>
                    <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
                    Partners can see it
                  </label>
                  <button
                    className={styles.docSave}
                    disabled={pending || !url.trim()}
                    onClick={() => run(() => addDealDocument({
                      activeDealId: dealId, kind, url, label, visibleToPartners: shared,
                    }))}
                  >
                    {pending ? 'Saving…' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Where the link points, so you can tell a Drive folder from a Notion page at a glance. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
