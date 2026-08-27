'use client'

import { describeError } from '@/lib/client-errors'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { issueDocument, getDocumentUrl, revokeDocument } from '@/app/actions/documents'
import { DOCUMENT_CATEGORY_LABELS, SIGNATURE_MODE_LABELS } from '@/lib/types'
import type { DocumentType, IssuedDocument, EmployeeRow, DocumentCategory } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from '../hr-zone.module.css'

/** Mirrors the server-side template field spec. Kept in sync by the code list below. */
type FieldSpec = { name: string; label: string; type: string; required?: boolean; hint?: string }

export default function DocumentsTab({
  types, issuable, issued, roster, templateFields, currentUserId,
}: {
  types: DocumentType[]
  /** Codes this viewer's role may issue, from document_permissions. */
  issuable: string[]
  issued: IssuedDocument[]
  roster: EmployeeRow[]
  /** documentCode -> extra inputs the letter needs. Empty array means none. */
  templateFields: Record<string, FieldSpec[]>
  currentUserId: string
}) {
  const router = useRouter()
  const [subjectId, setSubjectId] = useState('')
  const [code, setCode] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ humanId: string; verifyUrl: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [revoking, setRevoking] = useState<string | null>(null)

  const issuableSet = useMemo(() => new Set(issuable), [issuable])

  // Only types this role may issue AND that have a template — offering a button that always
  // fails is worse than not offering it.
  const available = useMemo(
    () => types.filter((t) => issuableSet.has(t.code) && t.code in templateFields),
    [types, issuableSet, templateFields],
  )

  const byCategory = useMemo(() => {
    const groups = new Map<DocumentCategory, DocumentType[]>()
    for (const t of available) {
      if (!groups.has(t.category)) groups.set(t.category, [])
      groups.get(t.category)!.push(t)
    }
    return [...groups.entries()]
  }, [available])

  const selectedType = available.find((t) => t.code === code) ?? null
  const fields = code ? (templateFields[code] ?? []) : []

  function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setResult(null)
    if (!subjectId || !code) { setError('Choose a person and a document type.'); return }

    startTransition(async () => {
      try {
        const doc = await issueDocument({ documentCode: code, subjectUserId: subjectId, extras })
        setResult({ humanId: doc.humanId, verifyUrl: doc.verifyUrl })
        setExtras({})
        router.refresh()
      } catch (err) {
        setError(describeError(err).message)
      }
    })
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      try {
        const url = await getDocumentUrl(id)
        if (!url) { setError('That document has no file — generation may have failed.'); return }
        window.open(url, '_blank', 'noopener')
      } catch (err) {
        setError(describeError(err).message)
      }
    })
  }

  function handleRevoke(id: string) {
    const reason = prompt('Why is this document being withdrawn?')
    if (!reason?.trim()) return
    setRevoking(id)
    startTransition(async () => {
      try { await revokeDocument(id, reason); router.refresh() }
      catch (err) { setError(describeError(err).message) }
      finally { setRevoking(null) }
    })
  }

  return (
    <div className={styles.docsLayout}>
      {/* ── Issue ── */}
      <form className={styles.docIssue} onSubmit={handleIssue}>
        <div className={styles.formSectionTitle} style={{ marginTop: 0 }}>Generate a document</div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>For *</span>
            <select className={styles.input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Choose a person…</option>
              {roster.map((r) => (
                <option key={r.user.id} value={r.user.id}>
                  {r.user.name || r.user.email}{r.profile ? '' : ' — no profile'}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Document *</span>
            <select
              className={styles.input}
              value={code}
              onChange={(e) => { setCode(e.target.value); setExtras({}); setResult(null); setError(null) }}
            >
              <option value="">Choose a document…</option>
              {byCategory.map(([category, list]) => (
                <optgroup key={category} label={DOCUMENT_CATEGORY_LABELS[category]}>
                  {list.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {selectedType && (
          <div className={styles.docModeNote}>
            {SIGNATURE_MODE_LABELS[selectedType.signature_mode]}
            {selectedType.signature_mode === 'physical' && ' — print and sign before issuing.'}
            {selectedType.signature_mode === 'system' && ' — no signature needed.'}
          </div>
        )}

        {fields.length > 0 && (
          <div className={styles.formGrid}>
            {fields.map((f) => (
              <label key={f.name} className={`${styles.field} ${f.type === 'textarea' ? styles.fieldWide : ''}`}>
                <span className={styles.label}>{f.label}{f.required ? ' *' : ''}</span>
                {f.type === 'textarea' ? (
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    value={extras[f.name] ?? ''}
                    onChange={(e) => setExtras((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                ) : (
                  <input
                    className={styles.input}
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={extras[f.name] ?? ''}
                    onChange={(e) => setExtras((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                )}
                {f.hint && <span className={styles.hint}>{f.hint}</span>}
              </label>
            ))}
          </div>
        )}

        {error && <div className={styles.formError}>{error}</div>}

        {result && (
          <div className={styles.docSuccess}>
            <strong>{result.humanId}</strong> issued.
            <div className={styles.hint} style={{ marginTop: '0.25rem' }}>
              Verifiable at <span className={styles.mono}>{result.verifyUrl}</span> — printed in the
              document footer.
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryBtn} disabled={isPending || !subjectId || !code}>
            {isPending ? 'Generating…' : 'Generate document'}
          </button>
        </div>
      </form>

      {/* ── History ── */}
      <div className={styles.docHistory}>
        <div className={styles.formSectionTitle} style={{ marginTop: 0 }}>Issued documents</div>
        {issued.length === 0 ? (
          <div className={styles.empty}>Nothing issued yet.</div>
        ) : (
          <div className={styles.docList}>
            {issued.map((d) => (
              <div key={d.id} className={`${styles.docRow} ${d.revoked_at ? styles.docRevoked : ''}`}>
                <Avatar name={d.subject?.name} photoUrl={d.subject?.photo_url} size="md" />
                <div className={styles.docMain}>
                  <div className={styles.docTitle}>
                    {d.document_type?.name ?? d.document_code}
                    {d.revoked_at && <span className={styles.docRevokedTag}>Withdrawn</span>}
                    {!d.storage_path && !d.revoked_at && (
                      <span className={styles.docFailedTag} title="The record exists but the PDF was not generated">
                        No file
                      </span>
                    )}
                  </div>
                  <div className={styles.docMeta}>
                    <span className={styles.mono}>{d.human_id}</span>
                    {' · '}{d.subject?.name ?? 'Unknown'}
                    {' · '}{formatDateTimeIst(d.issued_at)}
                    {d.issuer?.name ? ` · by ${d.issuer.name}` : ''}
                  </div>
                  {d.revoked_reason && <div className={styles.docReason}>{d.revoked_reason}</div>}
                </div>
                <div className={styles.docActions}>
                  {d.storage_path && (
                    <button type="button" className={styles.ghostBtn} onClick={() => handleDownload(d.id)} disabled={isPending}>
                      Open
                    </button>
                  )}
                  {!d.revoked_at && (
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => handleRevoke(d.id)}
                      disabled={isPending || revoking === d.id}
                    >
                      {revoking === d.id ? '…' : 'Withdraw'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
