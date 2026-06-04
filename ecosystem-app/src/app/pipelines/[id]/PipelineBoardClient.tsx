'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addStage, updateStage, deleteStage, moveEntry, deleteEntry, assignEntry, getEntryAnswers } from '@/app/actions/pipelines'
import { linkFormToPipeline } from '@/app/actions/forms'
import type { Pipeline, PipelineStage, PipelineEntry } from '@/lib/types'
import styles from './board.module.css'

const STAGE_COLORS = ['#745FFD', '#16a34a', '#d97706', '#dc2626', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6']

type AnswerItem = {
  id: string
  node_id: string
  answer_text: string | null
  node: { question_text: string | null; answer_type: string | null } | null
}

type FormItem = { id: string; title: string; published: boolean; pipeline_id: string | null }

export default function PipelineBoardClient({
  pipeline: initial,
  entries: initialEntries,
  canManage,
  teamMembers,
  forms: initialForms,
}: {
  pipeline: Pipeline
  entries: PipelineEntry[]
  canManage: boolean
  teamMembers: Array<{ id: string; name: string }>
  forms: FormItem[]
}) {
  const router = useRouter()
  const [pipeline, setPipeline] = useState(initial)
  const [entries, setEntries] = useState(initialEntries)
  const [forms, setForms] = useState(initialForms)
  const [, startTransition] = useTransition()

  // Forms modal
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [formsLinkPending, startFormsTransition] = useTransition()

  const linkedForms = forms.filter((f) => f.pipeline_id === pipeline.id)
  const unlinkableForms = forms.filter((f) => f.pipeline_id !== null && f.pipeline_id !== pipeline.id)

  function handleLinkForm(formId: string) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, pipeline_id: pipeline.id } : f))
    startFormsTransition(async () => { await linkFormToPipeline(formId, pipeline.id) })
  }

  function handleUnlinkForm(formId: string) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, pipeline_id: null } : f))
    startFormsTransition(async () => { await linkFormToPipeline(formId, null) })
  }

  // Stage modal
  const [showStageModal, setShowStageModal] = useState(false)
  const [editStage, setEditStage] = useState<PipelineStage | null>(null)
  const [stageName, setStageName] = useState('')
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0])
  const [stageError, setStageError] = useState('')
  const [stageIsPending, startStageTransition] = useTransition()

  // Entry detail
  const [selectedEntry, setSelectedEntry] = useState<PipelineEntry | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerItem[]>([])
  const [answersLoading, setAnswersLoading] = useState(false)

  // Drag and drop
  const [dragEntryId, setDragEntryId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | 'unsorted' | null>(null)

  function openAddStage() {
    setEditStage(null); setStageName(''); setStageColor(STAGE_COLORS[pipeline.stages.length % STAGE_COLORS.length]); setStageError(''); setShowStageModal(true)
  }
  function openEditStage(s: PipelineStage) {
    setEditStage(s); setStageName(s.name); setStageColor(s.color); setStageError(''); setShowStageModal(true)
  }

  function handleSaveStage(e: React.FormEvent) {
    e.preventDefault()
    if (!stageName.trim()) return
    setStageError('')
    startStageTransition(async () => {
      try {
        if (editStage) {
          await updateStage(editStage.id, stageName, stageColor)
          setPipeline((p) => ({ ...p, stages: p.stages.map((s) => s.id === editStage.id ? { ...s, name: stageName.trim(), color: stageColor } : s) }))
        } else {
          await addStage(pipeline.id, stageName, stageColor, pipeline.stages.length)
          router.refresh()
        }
        setShowStageModal(false)
      } catch (err) { setStageError(String(err)) }
    })
  }

  function handleDeleteStage(s: PipelineStage) {
    if (!confirm(`Delete stage "${s.name}"? Entries will become unsorted.`)) return
    startStageTransition(async () => {
      await deleteStage(s.id)
      setPipeline((p) => ({ ...p, stages: p.stages.filter((st) => st.id !== s.id) }))
      setEntries((prev) => prev.map((e) => e.stage_id === s.id ? { ...e, stage_id: null } : e))
    })
  }

  function handleMoveEntry(entryId: string, newStageId: string | null) {
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, stage_id: newStageId } : e))
    startTransition(async () => { await moveEntry(entryId, newStageId) })
  }

  function handleDeleteEntry(entryId: string) {
    if (!confirm('Delete this submission?')) return
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    setSelectedEntry(null)
    startTransition(async () => { await deleteEntry(entryId) })
  }

  async function handleOpenEntry(entry: PipelineEntry) {
    setSelectedEntry(entry)
    setSelectedAnswers([])
    setAnswersLoading(true)
    try {
      const answers = await getEntryAnswers(entry.id)
      setSelectedAnswers(answers)
    } finally {
      setAnswersLoading(false)
    }
  }

  function handleAssign(entryId: string, userId: string) {
    const assignedTo = userId || null
    const assignee = assignedTo ? (teamMembers.find((m) => m.id === assignedTo) ?? null) : null
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, assigned_to: assignedTo, assignee } : e))
    setSelectedEntry((prev) => prev ? { ...prev, assigned_to: assignedTo, assignee } : null)
    startTransition(async () => { await assignEntry(entryId, assignedTo) })
  }

  // Drag and drop handlers
  function handleDragStart(entryId: string) { setDragEntryId(entryId) }
  function handleDragEnd() { setDragEntryId(null); setDragOverStageId(null) }
  function handleDragOver(e: React.DragEvent, stageKey: string) { e.preventDefault(); setDragOverStageId(stageKey) }
  function handleDrop(stageId: string | null) {
    if (dragEntryId) handleMoveEntry(dragEntryId, stageId)
    setDragEntryId(null); setDragOverStageId(null)
  }

  const unsorted = entries.filter((e) => !e.stage_id || !pipeline.stages.find((s) => s.id === e.stage_id))

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Link href="/pipelines" className={styles.backLink}>← Pipelines</Link>
          <div className={styles.pipelineTitle}>{pipeline.name}</div>
          {pipeline.description && <div className={styles.pipelineSub}>{pipeline.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canManage && (
            <button className={styles.formsBtn} onClick={() => setShowFormsModal(true)}>
              Forms {linkedForms.length > 0 && <span className={styles.formsBadge}>{linkedForms.length}</span>}
            </button>
          )}
          {canManage && (
            <button className={styles.addStageBtn} onClick={openAddStage}>+ Add Stage</button>
          )}
        </div>
      </div>

      <div className={styles.board}>
        {pipeline.stages.map((stage) => {
          const stageEntries = entries.filter((e) => e.stage_id === stage.id)
          const isDragOver = dragOverStageId === stage.id
          return (
            <div key={stage.id} className={styles.column}>
              <div className={styles.columnHeader} style={{ borderTopColor: stage.color }}>
                <div className={styles.columnTitle}>{stage.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={styles.columnCount}>{stageEntries.length}</span>
                  {canManage && (
                    <button className={styles.stageMenuBtn} onClick={() => openEditStage(stage)} title="Edit stage">⚙</button>
                  )}
                </div>
              </div>
              <div
                className={`${styles.columnBody} ${isDragOver ? styles.columnBodyDragOver : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDrop={() => handleDrop(stage.id)}
                onDragLeave={() => setDragOverStageId(null)}
              >
                {stageEntries.length === 0 && !isDragOver ? (
                  <div className={styles.emptyCol}>No entries</div>
                ) : (
                  stageEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      isDragging={dragEntryId === entry.id}
                      onDragStart={() => handleDragStart(entry.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenEntry(entry)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}

        {(unsorted.length > 0 || dragOverStageId === 'unsorted') && (
          <div className={styles.column}>
            <div className={styles.columnHeader} style={{ borderTopColor: 'var(--color-muted)' }}>
              <div className={styles.columnTitle} style={{ color: 'var(--color-muted)' }}>Unsorted</div>
              <span className={styles.columnCount}>{unsorted.length}</span>
            </div>
            <div
              className={`${styles.columnBody} ${dragOverStageId === 'unsorted' ? styles.columnBodyDragOver : ''}`}
              onDragOver={(e) => handleDragOver(e, 'unsorted')}
              onDrop={() => handleDrop(null)}
              onDragLeave={() => setDragOverStageId(null)}
            >
              {unsorted.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isDragging={dragEntryId === entry.id}
                  onDragStart={() => handleDragStart(entry.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleOpenEntry(entry)}
                />
              ))}
            </div>
          </div>
        )}

        {pipeline.stages.length === 0 && entries.length === 0 && (
          <div className={styles.emptyBoard}>
            <div>Add stages to this pipeline, then link a form to start collecting submissions.</div>
            {canManage && <button className={styles.addStageBtn} style={{ marginTop: '1rem' }} onClick={openAddStage}>+ Add First Stage</button>}
          </div>
        )}
      </div>

      {/* Forms modal */}
      {showFormsModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowFormsModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Linked Forms</div>

            {/* Currently linked */}
            <div className={styles.label} style={{ marginBottom: '0.5rem' }}>Sending submissions here</div>
            {linkedForms.length === 0 ? (
              <p className={styles.formsEmpty}>No forms linked yet — link one below.</p>
            ) : (
              <div className={styles.formsList}>
                {linkedForms.map((f) => (
                  <div key={f.id} className={styles.formsRow}>
                    <div className={styles.formsRowInfo}>
                      <span className={styles.formsRowTitle}>{f.title}</span>
                      <span className={`${styles.formsBadgeInline} ${f.published ? styles.formsBadgePublished : styles.formsBadgeDraft}`}>
                        {f.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <button className={styles.formsUnlinkBtn} onClick={() => handleUnlinkForm(f.id)} disabled={formsLinkPending}>
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Available to link */}
            {forms.filter((f) => f.pipeline_id === null).length > 0 && (
              <>
                <div className={styles.label} style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>Link a form</div>
                <div className={styles.formsList}>
                  {forms.filter((f) => f.pipeline_id === null).map((f) => (
                    <div key={f.id} className={styles.formsRow}>
                      <div className={styles.formsRowInfo}>
                        <span className={styles.formsRowTitle}>{f.title}</span>
                        <span className={`${styles.formsBadgeInline} ${f.published ? styles.formsBadgePublished : styles.formsBadgeDraft}`}>
                          {f.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <button className={styles.formsLinkBtn} onClick={() => handleLinkForm(f.id)} disabled={formsLinkPending}>
                        Link
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {unlinkableForms.length > 0 && (
              <>
                <div className={styles.label} style={{ marginTop: '1.25rem', marginBottom: '0.5rem', opacity: 0.6 }}>Linked to another pipeline</div>
                <div className={styles.formsList}>
                  {unlinkableForms.map((f) => (
                    <div key={f.id} className={styles.formsRow} style={{ opacity: 0.5 }}>
                      <span className={styles.formsRowTitle}>{f.title}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={styles.modalActions}>
              <button className={styles.submitBtn} onClick={() => setShowFormsModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage modal */}
      {showStageModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowStageModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{editStage ? 'Edit Stage' : 'Add Stage'}</div>
            <form onSubmit={handleSaveStage}>
              <div className={styles.field}>
                <label className={styles.label}>Stage Name *</label>
                <input className={styles.input} value={stageName} onChange={(e) => setStageName(e.target.value)} required autoFocus placeholder="e.g. In Review" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Colour</label>
                <div className={styles.colorRow}>
                  {STAGE_COLORS.map((c) => (
                    <button type="button" key={c} className={`${styles.colorSwatch} ${stageColor === c ? styles.colorSwatchActive : ''}`} style={{ background: c }} onClick={() => setStageColor(c)} />
                  ))}
                </div>
              </div>
              {stageError && <p className={styles.errorMsg}>{stageError}</p>}
              <div className={styles.modalActions}>
                {editStage && (
                  <button type="button" className={styles.deleteBtn} onClick={() => { setShowStageModal(false); handleDeleteStage(editStage) }}>Delete Stage</button>
                )}
                <button type="button" className={styles.cancelBtn} onClick={() => setShowStageModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={stageIsPending}>{stageIsPending ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entry detail modal */}
      {selectedEntry && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setSelectedEntry(null)}>
          <div className={`${styles.modal} ${styles.entryModal}`} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{selectedEntry.title || 'Submission'}</div>

            {/* Submitter + link info */}
            <div className={styles.entryMeta2}>
              {selectedEntry.submitter_name && <span className={styles.metaChip}>{selectedEntry.submitter_name}</span>}
              {selectedEntry.submitter_email && <span className={styles.metaChip}>{selectedEntry.submitter_email}</span>}
              <span className={styles.metaChip}>{new Date(selectedEntry.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {selectedEntry.link_creator?.name && (
                <span className={styles.metaChipAccent}>via {selectedEntry.link_creator.name}'s link</span>
              )}
            </div>

            {/* Assign to */}
            {canManage && (
              <div className={styles.field}>
                <label className={styles.label}>Assigned To</label>
                <select
                  className={styles.select}
                  value={selectedEntry.assigned_to ?? ''}
                  onChange={(e) => handleAssign(selectedEntry.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            {!canManage && selectedEntry.assignee && (
              <div className={styles.field}>
                <label className={styles.label}>Assigned To</label>
                <div className={styles.assigneeDisplay}>{selectedEntry.assignee.name}</div>
              </div>
            )}

            {/* Stage */}
            <div className={styles.field}>
              <label className={styles.label}>Stage</label>
              <select
                className={styles.select}
                value={selectedEntry.stage_id ?? ''}
                onChange={(e) => {
                  handleMoveEntry(selectedEntry.id, e.target.value || null)
                  setSelectedEntry((prev) => prev ? { ...prev, stage_id: e.target.value || null } : null)
                }}
              >
                <option value="">Unsorted</option>
                {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Form Q&A */}
            <div className={styles.answersSection}>
              <div className={styles.label}>Responses</div>
              {answersLoading ? (
                <div className={styles.answersLoading}>Loading…</div>
              ) : selectedAnswers.length === 0 ? (
                <div className={styles.answersEmpty}>No answers recorded.</div>
              ) : (
                <div className={styles.answersList}>
                  {selectedAnswers.map((a, i) => (
                    <div key={a.id} className={styles.answerItem}>
                      <div className={styles.answerQ}>{i + 1}. {a.node?.question_text ?? 'Question'}</div>
                      <div className={styles.answerA}>{a.answer_text || <em style={{ opacity: 0.5 }}>No answer</em>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              {canManage && <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteEntry(selectedEntry.id)}>Delete</button>}
              <button type="button" className={styles.submitBtn} onClick={() => setSelectedEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryCard({ entry, isDragging, onDragStart, onDragEnd, onClick }: {
  entry: PipelineEntry
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
}) {
  return (
    <div
      className={`${styles.entryCard} ${isDragging ? styles.entryCardDragging : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className={styles.entryTitle}>{entry.title || 'Untitled submission'}</div>
      {entry.submitter_name && <div className={styles.entryMeta}>{entry.submitter_name}</div>}
      {entry.assignee && <div className={styles.entryAssignee}>→ {entry.assignee.name}</div>}
      <div className={styles.entryDate}>{new Date(entry.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
    </div>
  )
}
