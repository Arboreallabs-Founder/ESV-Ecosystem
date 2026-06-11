'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createForm, deleteForm, generateFormLink, deleteFormLink } from '@/app/actions/forms'
import type { Form, Pipeline, FormLinkSummary } from '@/lib/types'
import styles from '../forms.module.css'

export default function FormList({ forms: initial, pipelines, canManage }: { forms: Form[]; pipelines: Pipeline[]; canManage: boolean }) {
  const router = useRouter()
  const [forms, setForms] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Generate link modal
  const [linkFormId, setLinkFormId] = useState<string | null>(null)
  const [linkLabel, setLinkLabel] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [linkPending, startLinkTransition] = useTransition()

  // View issued links modal
  const [viewLinksForm, setViewLinksForm] = useState<Form | null>(null)
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null)

  function handleDeleteLink(linkId: string) {
    setDeletingLinkId(linkId)
    startTransition(async () => {
      try {
        await deleteFormLink(linkId)
        setForms((prev) => prev.map((f) => ({
          ...f,
          links: (f.links ?? []).filter((l) => l.id !== linkId),
        })))
        setViewLinksForm((prev) => prev ? { ...prev, links: (prev.links ?? []).filter((l) => l.id !== linkId) } : null)
      } catch (err) { alert(String(err)) } finally { setDeletingLinkId(null) }
    })
  }

  function openLinkModal(formId: string) {
    setLinkFormId(formId); setLinkLabel(''); setGeneratedLink(null)
  }

  function handleGenerateLink() {
    if (!linkFormId) return
    startLinkTransition(async () => {
      try {
        const result = await generateFormLink(linkFormId, linkLabel)
        setGeneratedLink(`${window.location.origin}/f/${result.token}`)
        // Optimistically add the new link to the form's link list
        setForms((prev) => prev.map((f) => f.id === linkFormId ? {
          ...f,
          links: [{ id: result.id, label: linkLabel.trim() || null, created_at: new Date().toISOString(), creator: result.creatorName ? { name: result.creatorName } : null }, ...(f.links ?? [])]
        } : f))
      } catch (err) { alert(String(err)) }
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        const id = await createForm(title, desc, pipelineId || null)
        setShowAdd(false)
        setTitle(''); setDesc('')
        router.push(`/forms/${id}/builder`)
      } catch (err) {
        setError(String(err))
      }
    })
  }

  function handleDelete(formId: string, formTitle: string) {
    if (!confirm(`Delete form "${formTitle}"? All submissions will also be deleted.`)) return
    setForms((prev) => prev.filter((f) => f.id !== formId))
    startTransition(async () => { await deleteForm(formId) })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Forms</div>
          <div className={styles.pageSub}>{forms.length} form{forms.length !== 1 ? 's' : ''}</div>
        </div>
        {canManage && (
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>+ New Form</button>
        )}
      </div>

      {forms.length === 0 ? (
        <div className={styles.empty}>No forms yet. Create a form to start collecting submissions into a pipeline.</div>
      ) : (
        <div className={styles.grid}>
          {forms.map((f) => (
            <div key={f.id} className={styles.card}>
              <div className={styles.cardTop}>
                <Link href={`/forms/${f.id}/builder`} className={styles.cardTitle}>{f.title}</Link>
                <span className={`${styles.badge} ${f.published ? styles.badgePublished : styles.badgeDraft}`}>
                  {f.published ? 'Published' : 'Draft'}
                </span>
              </div>
              {f.description && <div className={styles.cardDesc}>{f.description}</div>}
              {f.pipeline && <div className={styles.cardPipeline}>→ {f.pipeline.name}</div>}
              {(f.links?.length ?? 0) > 0 && (
                <button className={styles.linksIssuedBtn} onClick={() => setViewLinksForm(f)}>
                  🔗 {f.links!.length} link{f.links!.length !== 1 ? 's' : ''} issued
                </button>
              )}
              <div className={styles.cardActions}>
                {canManage && <Link href={`/forms/${f.id}/builder`} className={styles.editBtn}>Edit / Build</Link>}
                {f.published && (
                  <button className={styles.getLinkBtn} onClick={() => openLinkModal(f.id)}>+ Get Link</button>
                )}
                {canManage && (
                  <button className={styles.deleteIconBtn} onClick={() => handleDelete(f.id, f.title)} title="Delete form">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View issued links modal */}
      {viewLinksForm && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setViewLinksForm(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Issued Links</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.25rem' }}>
              {viewLinksForm.title} · {viewLinksForm.links?.length ?? 0} link{(viewLinksForm.links?.length ?? 0) !== 1 ? 's' : ''}
            </p>
            <div className={styles.linksList}>
              {(viewLinksForm.links ?? []).map((l) => (
                <div key={l.id} className={styles.linksRow}>
                  <div className={styles.linksRowLeft}>
                    <div className={styles.linksRowWho}>{l.creator?.name ?? 'Unknown'}</div>
                    <div className={styles.linksRowMeta}>
                      {l.label && <span className={styles.linksRowLabel}>{l.label}</span>}
                      <span>{new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      className={styles.deleteIconBtn}
                      onClick={() => handleDeleteLink(l.id)}
                      disabled={deletingLinkId === l.id}
                      title="Delete this link"
                    >
                      {deletingLinkId === l.id ? '…' : '✕'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.submitBtn} onClick={() => setViewLinksForm(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate link modal — available to all users */}
      {linkFormId && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setLinkFormId(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Generate Shareable Link</div>
            {!generatedLink ? (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Label <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(optional)</span></label>
                  <input className={styles.input} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="e.g. LinkedIn Campaign" autoFocus />
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>The link will track that it was generated by you.</p>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setLinkFormId(null)}>Cancel</button>
                  <button className={styles.submitBtn} onClick={handleGenerateLink} disabled={linkPending}>{linkPending ? 'Generating…' : 'Generate'}</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.linkBox}>
                  <code className={styles.linkText}>{generatedLink}</code>
                  <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(generatedLink)}>Copy</button>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.75rem' }}>Share this link externally.</p>
                <div className={styles.modalActions}>
                  <button className={styles.submitBtn} onClick={() => setLinkFormId(null)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Form</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Form Title *</label>
                <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="e.g. Deal Intake Form" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is this form for?" rows={2} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Pipeline</label>
                {pipelines.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
                    <Link href="/pipelines" style={{ color: 'var(--color-primary)' }}>Create a pipeline first</Link> to link submissions.
                  </p>
                ) : (
                  <select className={styles.select} value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
                    <option value="">None (no pipeline)</option>
                    {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>{isPending ? 'Creating…' : 'Create & Open Builder'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
