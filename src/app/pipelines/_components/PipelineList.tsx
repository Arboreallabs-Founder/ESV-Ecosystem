'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPipeline, deletePipeline } from '@/app/actions/pipelines'
import type { Pipeline } from '@/lib/types'
import styles from '../pipelines.module.css'

export default function PipelineList({ pipelines: initial, canManage }: { pipelines: Pipeline[]; canManage: boolean }) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [deleteTarget, setDeleteTarget] = useState<Pipeline | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    startTransition(async () => {
      try {
        const id = await createPipeline(name, desc)
        setShowAdd(false)
        setName(''); setDesc('')
        router.push(`/pipelines/${id}`)
      } catch (err) {
        setError(String(err))
      }
    })
  }

  function openDelete(e: React.MouseEvent, p: Pipeline) {
    e.preventDefault()
    e.stopPropagation()
    setDeleteTarget(p)
    setDeleteConfirm('')
    setDeleteError('')
  }

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!deleteTarget) return
    setDeleteError('')
    startDeleteTransition(async () => {
      try {
        await deletePipeline(deleteTarget.id)
        setPipelines((prev) => prev.filter((p) => p.id !== deleteTarget.id))
        setDeleteTarget(null)
      } catch (err) {
        setDeleteError(String(err))
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Pipelines</div>
          <div className={styles.pageSub}>{pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''}</div>
        </div>
        {canManage && (
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>+ New Pipeline</button>
        )}
      </div>

      {pipelines.length === 0 ? (
        <div className={styles.empty}>
          No pipelines yet. Create one to start collecting form submissions.
        </div>
      ) : (
        <div className={styles.grid}>
          {pipelines.map((p) => (
            <div key={p.id} className={styles.cardWrapper}>
              <Link href={`/pipelines/${p.id}`} className={styles.card}>
                <div className={styles.cardName}>{p.name}</div>
                {p.description && <div className={styles.cardDesc}>{p.description}</div>}
                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}>{p.stages.length} stage{p.stages.length !== 1 ? 's' : ''}</span>
                  <span className={styles.metaItem}>{p.entry_count} entr{p.entry_count !== 1 ? 'ies' : 'y'}</span>
                </div>
                <div className={styles.stageRow}>
                  {p.stages.slice(0, 5).map((s) => (
                    <span key={s.id} className={styles.stageChip} style={{ background: `${s.color}22`, color: s.color, borderColor: `${s.color}44` }}>
                      {s.name}
                    </span>
                  ))}
                  {p.stages.length > 5 && <span className={styles.stageMore}>+{p.stages.length - 5}</span>}
                </div>
              </Link>
              {canManage && (
                <button className={styles.cardDeleteBtn} onClick={(e) => openDelete(e, p)} title="Delete pipeline">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Pipeline</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Name *</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Deal Intake" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What kinds of submissions does this track?" rows={3} />
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>{isPending ? 'Creating…' : 'Create Pipeline'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !isDeleting && setDeleteTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Delete Pipeline</div>
            <div className={styles.dangerBox}>
              <strong>This action is permanent and cannot be undone.</strong>
              <br /><br />
              Deleting <strong>{deleteTarget.name}</strong> will permanently destroy{' '}
              <strong>{deleteTarget.entry_count} deal{deleteTarget.entry_count !== 1 ? 's' : ''}</strong>,
              all stages, and all deal data inside it.
            </div>
            <form onSubmit={handleDelete}>
              <div className={styles.field}>
                <label className={styles.label}>Type <strong style={{ textTransform: 'none', letterSpacing: 0 }}>{deleteTarget.name}</strong> to confirm</label>
                <input
                  className={styles.input}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deleteTarget.name}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              {deleteError && <p className={styles.errorMsg}>{deleteError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</button>
                <button
                  type="submit"
                  className={styles.deleteBtn}
                  disabled={isDeleting || deleteConfirm !== deleteTarget.name}
                >
                  {isDeleting ? 'Deleting…' : 'Delete Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
