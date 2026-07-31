import { createClient } from '@/lib/supabase/server'
import type { DocumentVerification } from '@/lib/types'
import { SIGNATURE_MODE_LABELS } from '@/lib/types'
import styles from './verify.module.css'

/* Public document verification. No auth — this is the page a bank or landlord lands on from the
   QR code printed on a letter.

   It reads through the `verify_document` SECURITY DEFINER function rather than the table, so
   anonymous visitors never get SELECT on issued_documents. The function returns only what a
   verifier needs: what the document is, who it names, when it was issued, and whether it still
   stands. Never the payload, never the storage path, never the PDF itself — confirming a letter
   is genuine is a different thing from handing out a copy of it. */

export const dynamic = 'force-dynamic'

function formatIssued(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('verify_document', { p_token: token })
  const doc = (Array.isArray(data) ? data[0] : data) as DocumentVerification | undefined

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/esv-wordmark-black.jpg" alt="Earlyseed Ventures" className={styles.wordmark} />
        </div>

        {!doc ? (
          <>
            <div className={`${styles.status} ${styles.statusUnknown}`}>
              <span className={styles.statusIcon}>?</span>
              Document not recognised
            </div>
            <p className={styles.lede}>
              We have no record of a document with this reference. Check that the link or QR code
              was scanned correctly and in full.
            </p>
            <p className={styles.note}>
              If the link is correct and this message persists, the document did not originate from
              Earlyseed Ventures. Please contact us before relying on it.
            </p>
          </>
        ) : doc.revoked ? (
          <>
            {/* Revoked shows as revoked rather than 404ing. A dead link is indistinguishable from
                a forgery, which would defeat the point of verifying at all. */}
            <div className={`${styles.status} ${styles.statusRevoked}`}>
              <span className={styles.statusIcon}>!</span>
              This document has been withdrawn
            </div>
            <p className={styles.lede}>
              A document with this reference was issued by {doc.org_name}, but has since been
              withdrawn and should not be relied upon.
            </p>
            <DocumentFacts doc={doc} />
          </>
        ) : (
          <>
            <div className={`${styles.status} ${styles.statusValid}`}>
              <span className={styles.statusIcon}>✓</span>
              Genuine document
            </div>
            <p className={styles.lede}>
              This document was issued by {doc.org_name} and remains valid.
            </p>
            <DocumentFacts doc={doc} />
            {doc.signature_mode === 'physical' && (
              <p className={styles.note}>
                This document type is valid only when signed by hand by an authorised signatory.
                Confirm that the copy you hold bears a signature.
              </p>
            )}
          </>
        )}

        <p className={styles.footer}>
          Verification confirms that a document with this reference was issued and what it states.
          It does not reproduce the document. For a copy, contact the issuing organisation.
        </p>
      </div>
    </main>
  )
}

function DocumentFacts({ doc }: { doc: DocumentVerification }) {
  return (
    <dl className={styles.facts}>
      <div className={styles.fact}>
        <dt>Reference</dt>
        <dd className={styles.mono}>{doc.human_id}</dd>
      </div>
      <div className={styles.fact}>
        <dt>Document</dt>
        <dd>{doc.document_name}</dd>
      </div>
      {/* Showing the name is what lets a verifier check the letter in front of them matches this
          record — a page that only says "a valid document exists" tells them nothing useful. */}
      <div className={styles.fact}>
        <dt>Issued to</dt>
        <dd>{doc.subject_name ?? '—'}</dd>
      </div>
      <div className={styles.fact}>
        <dt>Issued on</dt>
        <dd>{formatIssued(doc.issued_at)}</dd>
      </div>
      <div className={styles.fact}>
        <dt>Signature</dt>
        <dd>{SIGNATURE_MODE_LABELS[doc.signature_mode]}</dd>
      </div>
    </dl>
  )
}
