'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addStage, updateStage, deleteStage, moveEntry, deleteEntry, addAssignee, removeAssignee, rejectEntry, getEntryAnswers, saveStageQuestions, moveEntryWithStageAnswers, saveEntryStageAnswers, getEntryStageAnswers } from '@/app/actions/pipelines'
import { linkFormToPipeline } from '@/app/actions/forms'
import { getCategories, acceptDeal } from '@/app/actions/active-deals'
import type { Pipeline, PipelineStage, PipelineEntry, DealCategory, PipelineStageQuestion, StageAnswerView, StageQuestionFieldType } from '@/lib/types'
import styles from './board.module.css'

const STAGE_COLORS = ['#745FFD', '#16a34a', '#d97706', '#dc2626', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6']

const QUESTION_TYPE_LABELS: Record<StageQuestionFieldType, string> = {
  text: 'Text', numeric: 'Numeric', percentage: 'Percentage (%)', url: 'URL',
}

type QuestionDraft = { key: string; id?: string; label: string; field_type: StageQuestionFieldType; required: boolean }

function inputTypeFor(t: StageQuestionFieldType) {
  return t === 'numeric' || t === 'percentage' ? 'number' : t === 'url' ? 'url' : 'text'
}

function formatStageValue(value: string, fieldType: string) {
  if (fieldType === 'url') {
    try {
      const url = new URL(value)
      return <a href={url.href} target="_blank" rel="noopener noreferrer" className={styles.answerLink}>{url.hostname.replace('www.', '')}</a>
    } catch { return value }
  }
  if (fieldType === 'percentage') return `${value}%`
  return value
}

const STAGE_TYPE_LABELS: Record<string, string> = {
  lead: 'Lead', accepted: 'Accepted', rejected: 'Rejected',
}

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
  currentUserId,
}: {
  pipeline: Pipeline
  entries: PipelineEntry[]
  canManage: boolean
  teamMembers: Array<{ id: string; name: string }>
  forms: FormItem[]
  currentUserId?: string
}) {
  const router = useRouter()
  const [pipeline, setPipeline] = useState(initial)
  const [entries, setEntries] = useState(initialEntries)
  const [forms, setForms] = useState(initialForms)
  const [, startTransition] = useTransition()

  // Stage modal
  const [showStageModal, setShowStageModal] = useState(false)
  const [editStage, setEditStage] = useState<PipelineStage | null>(null)
  const [stageName, setStageName] = useState('')
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0])
  const [stageError, setStageError] = useState('')
  const [stageIsPending, startStageTransition] = useTransition()
  const [stageQuestions, setStageQuestions] = useState<QuestionDraft[]>([])

  // Entry detail
  const [selectedEntry, setSelectedEntry] = useState<PipelineEntry | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerItem[]>([])
  const [answersLoading, setAnswersLoading] = useState(false)
  const [selectedStageAnswers, setSelectedStageAnswers] = useState<StageAnswerView[]>([])

  // Stage-question answer modal — capture on move-in, and admin edit later
  const [answerModal, setAnswerModal] = useState<{ mode: 'move' | 'edit'; entryId: string; stageId: string; stageName: string; questions: PipelineStageQuestion[] } | null>(null)
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({})
  const [answerError, setAnswerError] = useState('')
  const [answerPending, startAnswerTransition] = useTransition()

  // Rejection modal
  const [rejectionPending, setRejectionPending] = useState<{ entryId: string; stageId: string } | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Assignee gate
  const [assigneeGateEntry, setAssigneeGateEntry] = useState<string | null>(null)

  // Acceptance modal
  const [acceptancePending, setAcceptancePending] = useState<{ entryId: string; stageId: string } | null>(null)
  const [acceptCategories, setAcceptCategories] = useState<DealCategory[]>([])
  const [acceptCategoriesLoaded, setAcceptCategoriesLoaded] = useState(false)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [acceptFieldValues, setAcceptFieldValues] = useState<Record<string, Record<string, string>>>({})
  const [acceptError, setAcceptError] = useState('')
  const [isAccepting, startAcceptTransition] = useTransition()

  // Forms modal
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [formsLinkPending, startFormsTransition] = useTransition()

  // Drag and drop
  const [dragEntryId, setDragEntryId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | 'unsorted' | null>(null)

  // Associates can only drag/move entries they're personally assigned to
  const canMoveEntry = (entry: PipelineEntry) => {
    if (canManage) return true
    if (!currentUserId) return false
    return (entry.assignees ?? []).some((a) => a.user_id === currentUserId)
  }

  const linkedForms = forms.filter((f) => f.pipeline_id === pipeline.id)
  const unlinkableForms = forms.filter((f) => f.pipeline_id !== null && f.pipeline_id !== pipeline.id)

  // Sort stages: lead first, then custom by position, then accepted, then rejected
  const sortedStages = [...pipeline.stages].sort((a, b) => {
    const order = { lead: -100, custom: 0, accepted: 100, rejected: 101 }
    const aOrder = (order[a.stage_type] ?? 0) + a.position
    const bOrder = (order[b.stage_type] ?? 0) + b.position
    return aOrder - bOrder
  })

  const rejectedStageIds = new Set(pipeline.stages.filter((s) => s.stage_type === 'rejected').map((s) => s.id))
  const acceptedStageIds = new Set(pipeline.stages.filter((s) => s.stage_type === 'accepted').map((s) => s.id))

  function openAddStage() {
    setEditStage(null); setStageName(''); setStageColor(STAGE_COLORS[pipeline.stages.filter(s => s.stage_type === 'custom').length % STAGE_COLORS.length]); setStageError(''); setStageQuestions([]); setShowStageModal(true)
  }
  function openEditStage(s: PipelineStage) {
    setEditStage(s); setStageName(s.name); setStageColor(s.color); setStageError('')
    setStageQuestions((s.questions ?? []).map((q) => ({ key: q.id, id: q.id, label: q.label, field_type: q.field_type, required: q.required })))
    setShowStageModal(true)
  }

  function addQuestionDraft() {
    setStageQuestions((qs) => [...qs, { key: crypto.randomUUID(), label: '', field_type: 'text', required: false }])
  }
  function setQuestionDraft(key: string, patch: Partial<QuestionDraft>) {
    setStageQuestions((qs) => qs.map((q) => q.key === key ? { ...q, ...patch } : q))
  }
  function removeQuestionDraft(key: string) {
    setStageQuestions((qs) => qs.filter((q) => q.key !== key))
  }

  function handleSaveStage(e: React.FormEvent) {
    e.preventDefault()
    if (!stageName.trim()) return
    setStageError('')
    const items = stageQuestions
      .filter((q) => q.label.trim())
      .map((q, i) => ({ id: q.id, label: q.label.trim(), field_type: q.field_type, required: q.required, position: i }))
    startStageTransition(async () => {
      try {
        if (editStage) {
          await updateStage(editStage.id, stageName, stageColor)
          await saveStageQuestions(editStage.id, items)
        } else {
          const newId = await addStage(pipeline.id, stageName, stageColor, pipeline.stages.filter(s => s.stage_type === 'custom').length)
          if (items.length > 0) await saveStageQuestions(newId, items)
        }
        setShowStageModal(false)
        router.refresh()
      } catch (err) { setStageError(String(err)) }
    })
  }

  function handleDeleteStage(s: PipelineStage) {
    const activeCount = entries.filter((e) => e.stage_id === s.id).length
    if (activeCount > 0) {
      alert(`Cannot delete "${s.name}" — it has ${activeCount} active deal${activeCount !== 1 ? 's' : ''} in it. Move them to another stage first.`)
      return
    }
    if (!confirm(`Delete stage "${s.name}"?`)) return
    startStageTransition(async () => {
      await deleteStage(s.id)
      setPipeline((p) => ({ ...p, stages: p.stages.filter((st) => st.id !== s.id) }))
    })
  }

  function commitMoveEntry(entryId: string, newStageId: string | null) {
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, stage_id: newStageId } : e))
    startTransition(async () => { await moveEntry(entryId, newStageId) })
  }

  function handleMoveEntry(entryId: string, newStageId: string | null) {
    // Block stage moves if no assignee
    if (newStageId) {
      const entry = entries.find((e) => e.id === entryId)
      if (entry && (entry.assignees?.length ?? 0) === 0) {
        setAssigneeGateEntry(entryId)
        setTimeout(() => setAssigneeGateEntry(null), 2500)
        return
      }
    }
    if (newStageId && rejectedStageIds.has(newStageId)) {
      setRejectionPending({ entryId, stageId: newStageId })
      setRejectionReason('')
      return
    }
    if (newStageId && acceptedStageIds.has(newStageId)) {
      setAcceptancePending({ entryId, stageId: newStageId })
      setSelectedCategoryIds([])
      setAcceptFieldValues({})
      setAcceptError('')
      if (!acceptCategoriesLoaded) {
        getCategories().then((cats) => { setAcceptCategories(cats); setAcceptCategoriesLoaded(true) })
      }
      return
    }
    // Custom stage with questions → prompt for answers before committing the move
    const targetStage = newStageId ? pipeline.stages.find((s) => s.id === newStageId) : null
    if (newStageId && targetStage && (targetStage.questions?.length ?? 0) > 0) {
      setAnswerModal({ mode: 'move', entryId, stageId: newStageId, stageName: targetStage.name, questions: targetStage.questions! })
      setAnswerValues({})
      setAnswerError('')
      return
    }
    commitMoveEntry(entryId, newStageId)
  }

  function stageHasQuestions(stageId: string | null) {
    if (!stageId) return false
    const s = pipeline.stages.find((st) => st.id === stageId)
    return (s?.questions?.length ?? 0) > 0
  }

  function handleConfirmAnswers() {
    if (!answerModal) return
    const { mode, entryId, stageId, questions } = answerModal
    for (const q of questions.filter((x) => x.required)) {
      if (!(answerValues[q.id] ?? '').trim()) { setAnswerError(`"${q.label}" is required.`); return }
    }
    setAnswerError('')
    const answers = questions.map((q) => ({ questionId: q.id, value: answerValues[q.id] ?? '' }))

    if (mode === 'move') {
      setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, stage_id: stageId } : e))
      if (selectedEntry?.id === entryId) setSelectedEntry((prev) => prev ? { ...prev, stage_id: stageId } : null)
      startAnswerTransition(async () => {
        try {
          await moveEntryWithStageAnswers(entryId, stageId, answers)
          if (selectedEntry?.id === entryId) getEntryStageAnswers(entryId).then(setSelectedStageAnswers)
        } catch (err) { alert(String(err)); router.refresh() }
      })
    } else {
      startAnswerTransition(async () => {
        try {
          await saveEntryStageAnswers(entryId, answers)
          getEntryStageAnswers(entryId).then(setSelectedStageAnswers)
        } catch (err) { alert(String(err)) }
      })
    }
    setAnswerModal(null)
  }

  function openEditAnswers(stageId: string, stageName: string) {
    if (!selectedEntry) return
    const stage = pipeline.stages.find((s) => s.id === stageId)
    const questions = stage?.questions ?? []
    const values: Record<string, string> = {}
    for (const a of selectedStageAnswers.filter((x) => x.stage_id === stageId)) {
      values[a.question_id] = a.value ?? ''
    }
    setAnswerValues(values)
    setAnswerError('')
    setAnswerModal({ mode: 'edit', entryId: selectedEntry.id, stageId, stageName, questions })
  }

  function handleConfirmAcceptance() {
    if (!acceptancePending) return
    const { entryId, stageId } = acceptancePending

    // Require at least 1 category if categories exist
    if (acceptCategoriesLoaded && acceptCategories.length > 0 && selectedCategoryIds.length === 0) {
      setAcceptError('Please select at least one category.')
      return
    }

    // Validate required fields
    for (const catId of selectedCategoryIds) {
      const cat = acceptCategories.find((c) => c.id === catId)
      if (!cat) continue
      for (const field of cat.fields.filter((f) => f.required)) {
        const val = acceptFieldValues[catId]?.[field.id] ?? ''
        if (!val.trim()) {
          setAcceptError(`"${field.label}" is required for category "${cat.name}".`)
          return
        }
      }
    }
    setAcceptError('')

    const selections = selectedCategoryIds.map((catId) => ({
      categoryId: catId,
      fieldValues: acceptFieldValues[catId] ?? {},
    }))

    // Optimistic update
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, stage_id: stageId } : e))
    if (selectedEntry?.id === entryId) setSelectedEntry((prev) => prev ? { ...prev, stage_id: stageId } : null)

    startAcceptTransition(async () => { await acceptDeal(entryId, stageId, selections) })
    setAcceptancePending(null)
  }

  function handleConfirmRejection() {
    if (!rejectionPending) return
    const { entryId, stageId } = rejectionPending
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, stage_id: stageId, rejection_reason: rejectionReason.trim() || null } : e))
    if (selectedEntry?.id === entryId) setSelectedEntry((prev) => prev ? { ...prev, stage_id: stageId, rejection_reason: rejectionReason.trim() || null } : null)
    startTransition(async () => { await rejectEntry(entryId, stageId, rejectionReason) })
    setRejectionPending(null)
    setRejectionReason('')
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
    setSelectedStageAnswers([])
    setAnswersLoading(true)
    try {
      const [answers, stageAnswers] = await Promise.all([
        getEntryAnswers(entry.id),
        getEntryStageAnswers(entry.id),
      ])
      setSelectedAnswers(answers)
      setSelectedStageAnswers(stageAnswers)
    } finally {
      setAnswersLoading(false)
    }
  }

  function handleAddAssignee(entryId: string, userId: string) {
    const member = teamMembers.find((m) => m.id === userId)
    if (!member) return
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, assignees: [...(e.assignees ?? []), { user_id: userId, name: member.name }] } : e))
    setSelectedEntry((prev) => prev ? { ...prev, assignees: [...(prev.assignees ?? []), { user_id: userId, name: member.name }] } : null)
    startTransition(async () => { await addAssignee(entryId, userId) })
  }

  function handleRemoveAssignee(entryId: string, userId: string) {
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, assignees: (e.assignees ?? []).filter((a) => a.user_id !== userId) } : e))
    setSelectedEntry((prev) => prev ? { ...prev, assignees: (prev.assignees ?? []).filter((a) => a.user_id !== userId) } : null)
    startTransition(async () => { await removeAssignee(entryId, userId) })
  }

  // Drag and drop
  function handleDragStart(entryId: string) { setDragEntryId(entryId) }
  function handleDragEnd() { setDragEntryId(null); setDragOverStageId(null) }
  function handleDragOver(e: React.DragEvent, stageKey: string) { e.preventDefault(); setDragOverStageId(stageKey) }
  function handleDrop(stageId: string | null) {
    if (dragEntryId) handleMoveEntry(dragEntryId, stageId)
    setDragEntryId(null); setDragOverStageId(null)
  }

  function handleLinkForm(formId: string) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, pipeline_id: pipeline.id } : f))
    startFormsTransition(async () => { await linkFormToPipeline(formId, pipeline.id) })
  }
  function handleUnlinkForm(formId: string) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, pipeline_id: null } : f))
    startFormsTransition(async () => { await linkFormToPipeline(formId, null) })
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
        {sortedStages.map((stage) => {
          const stageEntries = entries.filter((e) => e.stage_id === stage.id)
          const isDragOver = dragOverStageId === stage.id
          const isMandatory = stage.stage_type !== 'custom'
          return (
            <div key={stage.id} className={`${styles.column} ${isMandatory ? styles.columnMandatory : ''}`}>
              <div className={styles.columnHeader} style={{ borderTopColor: stage.color }}>
                <div className={styles.columnTitleRow}>
                  <div className={styles.columnTitle}>{stage.name}</div>
                  {isMandatory && (
                    <span className={`${styles.mandatoryBadge} ${styles[`mandatoryBadge_${stage.stage_type}`]}`}>
                      {STAGE_TYPE_LABELS[stage.stage_type]}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={styles.columnCount}>{stageEntries.length}</span>
                  {canManage && !isMandatory && (
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
                      canDrag={canMoveEntry(entry)}
                      onDragStart={() => handleDragStart(entry.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenEntry(entry)}
                      showAssigneeError={assigneeGateEntry === entry.id}
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
                <EntryCard key={entry.id} entry={entry} isDragging={dragEntryId === entry.id} canDrag={canMoveEntry(entry)} onDragStart={() => handleDragStart(entry.id)} onDragEnd={handleDragEnd} onClick={() => handleOpenEntry(entry)} showAssigneeError={assigneeGateEntry === entry.id} />
              ))}
            </div>
          </div>
        )}

        {pipeline.stages.filter(s => s.stage_type === 'custom').length === 0 && entries.length === 0 && (
          <div className={styles.emptyBoard}>
            <div>Add stages to this pipeline, then link a form to start collecting submissions.</div>
            {canManage && <button className={styles.addStageBtn} style={{ marginTop: '1rem' }} onClick={openAddStage}>+ Add First Stage</button>}
          </div>
        )}
      </div>

      {/* Rejection reason modal */}
      {rejectionPending && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setRejectionPending(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Reason for Rejection</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              Provide a reason — this will be stored with the submission.
            </p>
            <div className={styles.field}>
              <label className={styles.label}>Reason <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className={styles.input}
                style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Stage too early, outside our thesis, valuation mismatch…"
                autoFocus
                rows={3}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setRejectionPending(null)}>Cancel</button>
              <button className={styles.rejectConfirmBtn} onClick={handleConfirmRejection}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage questions modal (move-in capture + admin edit) */}
      {answerModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !answerPending && setAnswerModal(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{answerModal.stageName}</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              {answerModal.mode === 'move'
                ? 'Answer the following to move this entry into the stage.'
                : 'Update the recorded answers for this stage.'}
            </p>
            {answerModal.questions.map((q) => (
              <div key={q.id} className={styles.field} style={{ marginBottom: '0.75rem' }}>
                <label className={styles.label}>
                  {q.label}
                  {q.required && <span style={{ color: 'var(--color-primary)' }}> *</span>}
                  <span style={{ fontWeight: 400, marginLeft: '0.375rem', textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                    {q.field_type === 'percentage' ? '%' : q.field_type === 'numeric' ? 'number' : q.field_type === 'url' ? 'https://…' : ''}
                  </span>
                </label>
                <input
                  className={styles.input}
                  type={inputTypeFor(q.field_type)}
                  value={answerValues[q.id] ?? ''}
                  onChange={(e) => setAnswerValues((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.field_type === 'url' ? 'https://' : q.field_type === 'percentage' ? '0–100' : ''}
                  required={q.required}
                />
              </div>
            ))}
            {answerError && <p className={styles.errorMsg}>{answerError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setAnswerModal(null)} disabled={answerPending}>Cancel</button>
              <button className={styles.submitBtn} onClick={handleConfirmAnswers} disabled={answerPending}>
                {answerPending ? 'Saving…' : answerModal.mode === 'move' ? 'Save & Move →' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acceptance modal */}
      {acceptancePending && (() => {
        const entry = entries.find((e) => e.id === acceptancePending.entryId)
        return (
          <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !isAccepting && setAcceptancePending(null)}>
            <div className={`${styles.modal} ${styles.acceptModal}`} onMouseDown={(e) => e.stopPropagation()}>
              <div className={styles.modalTitle}>Accept Deal</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                Moving <strong style={{ color: 'var(--color-text)' }}>{entry?.title ?? 'this deal'}</strong> to Active Deals.
                Select the categories it belongs to and fill in any data fields.
              </p>

              {acceptCategoriesLoaded && acceptCategories.length === 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  No categories set up yet. You can still accept this deal — an admin can create categories under Admin → Categories.
                </p>
              )}

              {acceptCategories.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Categories <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
                  <div className={styles.categoryCheckList}>
                    {acceptCategories.map((cat) => (
                      <label key={cat.id} className={styles.categoryCheckRow}>
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={(e) => {
                            setSelectedCategoryIds((prev) =>
                              e.target.checked ? [...prev, cat.id] : prev.filter((id) => id !== cat.id)
                            )
                          }}
                        />
                        <span className={styles.catCheckDot} style={{ background: cat.color }} />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields for each selected category */}
              {selectedCategoryIds.map((catId) => {
                const cat = acceptCategories.find((c) => c.id === catId)
                if (!cat || cat.fields.length === 0) return null
                return (
                  <div key={catId} className={styles.acceptFieldGroup}>
                    <div className={styles.acceptFieldGroupLabel} style={{ color: cat.color }}>
                      {cat.name}
                    </div>
                    {cat.fields.map((field) => (
                      <div key={field.id} className={styles.field} style={{ marginBottom: '0.75rem' }}>
                        <label className={styles.label}>
                          {field.label}
                          {field.required && <span style={{ color: 'var(--color-primary)' }}> *</span>}
                          <span style={{ fontWeight: 400, marginLeft: '0.375rem', textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                            {field.field_type === 'percentage' ? '%' : field.field_type === 'numeric' ? 'number' : field.field_type === 'url' ? 'https://…' : ''}
                          </span>
                        </label>
                        <input
                          className={styles.input}
                          type={field.field_type === 'numeric' || field.field_type === 'percentage' ? 'number' : field.field_type === 'url' ? 'url' : 'text'}
                          value={acceptFieldValues[catId]?.[field.id] ?? ''}
                          onChange={(e) => setAcceptFieldValues((prev) => ({
                            ...prev,
                            [catId]: { ...(prev[catId] ?? {}), [field.id]: e.target.value },
                          }))}
                          placeholder={field.field_type === 'url' ? 'https://' : field.field_type === 'percentage' ? '0–100' : ''}
                          required={field.required}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}

              {acceptError && <p className={styles.errorMsg}>{acceptError}</p>}

              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setAcceptancePending(null)} disabled={isAccepting}>Cancel</button>
                <button className={styles.acceptConfirmBtn} onClick={handleConfirmAcceptance} disabled={isAccepting}>
                  {isAccepting ? 'Accepting…' : 'Accept Deal →'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              <div className={styles.field}>
                <label className={styles.label}>
                  Stage Questions <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--color-muted)' }}>(asked when an entry is moved into this stage)</span>
                </label>
                {stageQuestions.length > 0 && (
                  <div className={styles.questionDraftList}>
                    {stageQuestions.map((q) => (
                      <div key={q.key} className={styles.questionDraftRow}>
                        <input
                          className={styles.input}
                          value={q.label}
                          onChange={(e) => setQuestionDraft(q.key, { label: e.target.value })}
                          placeholder="Question label…"
                        />
                        <select
                          className={styles.select}
                          value={q.field_type}
                          onChange={(e) => setQuestionDraft(q.key, { field_type: e.target.value as StageQuestionFieldType })}
                        >
                          {(Object.keys(QUESTION_TYPE_LABELS) as StageQuestionFieldType[]).map((t) => (
                            <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                        <label className={styles.questionReqToggle} title="Required">
                          <input type="checkbox" checked={q.required} onChange={(e) => setQuestionDraft(q.key, { required: e.target.checked })} />
                          Req
                        </label>
                        <button type="button" className={styles.questionRemoveBtn} onClick={() => removeQuestionDraft(q.key)} title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className={styles.addQuestionBtn} onClick={addQuestionDraft}>+ Add question</button>
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
                <span className={styles.metaChipAccent}>
                  via {selectedEntry.link_creator.name}&apos;s link
                  {selectedEntry.form_link_label ? ` · "${selectedEntry.form_link_label}"` : ''}
                </span>
              )}
            </div>

            {/* Rejection reason (if rejected) */}
            {selectedEntry.rejection_reason && (
              <div className={styles.rejectionReasonBox}>
                <span className={styles.rejectionReasonLabel}>Rejection reason</span>
                <span className={styles.rejectionReasonText}>{selectedEntry.rejection_reason}</span>
              </div>
            )}

            {/* Multi-assignees */}
            {canManage && (
              <div className={styles.field}>
                <label className={styles.label}>Assigned To</label>
                <div className={styles.assigneeChips}>
                  {(selectedEntry.assignees ?? []).map((a) => (
                    <span key={a.user_id} className={styles.assigneeChip}>
                      {a.name}
                      <button className={styles.assigneeChipRemove} onClick={() => handleRemoveAssignee(selectedEntry.id, a.user_id)} title="Remove">×</button>
                    </span>
                  ))}
                  {(() => {
                    const assignedIds = new Set((selectedEntry.assignees ?? []).map((a) => a.user_id))
                    const available = teamMembers.filter((m) => !assignedIds.has(m.id))
                    if (available.length === 0) return null
                    return (
                      <select
                        className={styles.assigneeAdd}
                        value=""
                        onChange={(e) => { if (e.target.value) handleAddAssignee(selectedEntry.id, e.target.value) }}
                      >
                        <option value="">+ Add person</option>
                        {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )
                  })()}
                </div>
              </div>
            )}
            {!canManage && (selectedEntry.assignees ?? []).length > 0 && (
              <div className={styles.field}>
                <label className={styles.label}>Assigned To</label>
                <div className={styles.assigneeChips}>
                  {(selectedEntry.assignees ?? []).map((a) => (
                    <span key={a.user_id} className={styles.assigneeChip} style={{ cursor: 'default' }}>{a.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stage */}
            <div className={styles.field}>
              <label className={styles.label}>Stage</label>
              {canMoveEntry(selectedEntry) ? (
                <select
                  className={styles.select}
                  value={selectedEntry.stage_id ?? ''}
                  onChange={(e) => {
                    const newStageId = e.target.value || null
                    handleMoveEntry(selectedEntry.id, newStageId)
                    if (newStageId && !rejectedStageIds.has(newStageId) && !acceptedStageIds.has(newStageId) && !stageHasQuestions(newStageId)) {
                      setSelectedEntry((prev) => prev ? { ...prev, stage_id: newStageId } : null)
                    }
                  }}
                >
                  <option value="">Unsorted</option>
                  {sortedStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div className={styles.input} style={{ color: 'var(--color-muted)', cursor: 'default', userSelect: 'none' }}>
                  {sortedStages.find((s) => s.id === selectedEntry.stage_id)?.name ?? 'Unsorted'}
                </div>
              )}
            </div>

            {/* Stage inputs */}
            {selectedStageAnswers.length > 0 && (() => {
              const groups: Array<{ stage_id: string; stage_name: string; items: StageAnswerView[] }> = []
              for (const a of selectedStageAnswers) {
                let g = groups.find((x) => x.stage_id === a.stage_id)
                if (!g) { g = { stage_id: a.stage_id, stage_name: a.stage_name, items: [] }; groups.push(g) }
                g.items.push(a)
              }
              return (
                <div className={styles.answersSection}>
                  <div className={styles.label}>Stage Inputs</div>
                  <div className={styles.answersList}>
                    {groups.map((g) => (
                      <div key={g.stage_id} className={styles.stageAnswerGroup}>
                        <div className={styles.stageAnswerGroupHead}>
                          <span className={styles.stageAnswerGroupName}>{g.stage_name}</span>
                          {canManage && (
                            <button type="button" className={styles.stageAnswerEditBtn} onClick={() => openEditAnswers(g.stage_id, g.stage_name)}>Edit</button>
                          )}
                        </div>
                        {g.items.map((a) => (
                          <div key={a.question_id} className={styles.answerItem}>
                            <div className={styles.answerQ}>{a.label}</div>
                            <div className={styles.answerA}>{a.value ? formatStageValue(a.value, a.field_type) : <em style={{ opacity: 0.5 }}>No answer</em>}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Q&A */}
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

      {/* Forms modal */}
      {showFormsModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowFormsModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Linked Forms</div>
            <div className={styles.label} style={{ marginBottom: '0.5rem' }}>Sending submissions here</div>
            {linkedForms.length === 0 ? (
              <p className={styles.formsEmpty}>No forms linked yet.</p>
            ) : (
              <div className={styles.formsList}>
                {linkedForms.map((f) => (
                  <div key={f.id} className={styles.formsRow}>
                    <div className={styles.formsRowInfo}>
                      <span className={styles.formsRowTitle}>{f.title}</span>
                      <span className={`${styles.formsBadgeInline} ${f.published ? styles.formsBadgePublished : styles.formsBadgeDraft}`}>{f.published ? 'Published' : 'Draft'}</span>
                    </div>
                    <button className={styles.formsUnlinkBtn} onClick={() => handleUnlinkForm(f.id)} disabled={formsLinkPending}>Unlink</button>
                  </div>
                ))}
              </div>
            )}
            {forms.filter((f) => f.pipeline_id === null).length > 0 && (
              <>
                <div className={styles.label} style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>Link a form</div>
                <div className={styles.formsList}>
                  {forms.filter((f) => f.pipeline_id === null).map((f) => (
                    <div key={f.id} className={styles.formsRow}>
                      <div className={styles.formsRowInfo}>
                        <span className={styles.formsRowTitle}>{f.title}</span>
                        <span className={`${styles.formsBadgeInline} ${f.published ? styles.formsBadgePublished : styles.formsBadgeDraft}`}>{f.published ? 'Published' : 'Draft'}</span>
                      </div>
                      <button className={styles.formsLinkBtn} onClick={() => handleLinkForm(f.id)} disabled={formsLinkPending}>Link</button>
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
    </div>
  )
}

function EntryCard({ entry, isDragging, canDrag, onDragStart, onDragEnd, onClick, showAssigneeError }: {
  entry: PipelineEntry
  isDragging: boolean
  canDrag: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
  showAssigneeError: boolean
}) {
  return (
    <div
      className={`${styles.entryCard} ${isDragging ? styles.entryCardDragging : ''} ${showAssigneeError ? styles.entryCardError : ''}`}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={onClick}
    >
      <div className={styles.entryTitle}>{entry.title || 'Untitled submission'}</div>
      {entry.submitter_name && <div className={styles.entryMeta}>{entry.submitter_name}</div>}
      {entry.form_link_label && <div className={styles.entryLinkLabel}>{entry.form_link_label}</div>}
      {showAssigneeError && <div className={styles.assigneeGateMsg}>Assign someone first</div>}
      {(entry.assignees ?? []).length > 0 && (
        <div className={styles.entryAssignees}>
          {(entry.assignees ?? []).map((a) => (
            <span key={a.user_id} className={styles.entryAssigneeChip}>{a.name.split(' ')[0]}</span>
          ))}
        </div>
      )}
      <div className={styles.entryDate}>{new Date(entry.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
    </div>
  )
}
