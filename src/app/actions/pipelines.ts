'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole, requireAuth } from '@/lib/guards'
import type { StageQuestionFieldType } from '@/lib/types'

async function requireInternal() {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  return supabase
}

async function requireAdmin() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, userId, orgId }
}

export async function createPipeline(name: string, description: string) {
  const { supabase, userId, orgId } = await requireAdmin()
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ name: name.trim(), description: description.trim() || null, created_by: userId, org_id: orgId })
    .select('id')
    .single()
  if (error) throw error
  // Seed mandatory stages: Lead (first), Accepted and Rejected (ends)
  await supabase.from('pipeline_stages').insert([
    { pipeline_id: data.id, name: 'Lead', color: '#745FFD', position: -1, stage_type: 'lead' },
    { pipeline_id: data.id, name: 'Accepted', color: '#16a34a', position: 998, stage_type: 'accepted' },
    { pipeline_id: data.id, name: 'Rejected', color: '#dc2626', position: 999, stage_type: 'rejected' },
  ])
  return data.id
}

export async function updatePipeline(id: string, name: string, description: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('pipelines')
    .update({ name: name.trim(), description: description.trim() || null })
    .eq('id', id)
  if (error) throw error
  // No revalidatePath — router.refresh() in component
}

export async function deletePipeline(id: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('pipelines').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/pipelines')
}

export async function addStage(pipelineId: string, name: string, color: string, position: number) {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('pipeline_stages').insert({
    pipeline_id: pipelineId, name: name.trim(), color, position,
  }).select('id').single()
  if (error) throw error
  // No revalidatePath — router.refresh() in component
  return data.id as string
}

export async function updateStage(stageId: string, name: string, color: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('pipeline_stages')
    .update({ name: name.trim(), color })
    .eq('id', stageId)
  if (error) throw error
  // No revalidatePath — router.refresh() in component
}

export async function deleteStage(stageId: string) {
  const { supabase } = await requireAdmin()
  // Move entries to null stage first
  await supabase.from('pipeline_entries').update({ stage_id: null }).eq('stage_id', stageId)
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId)
  if (error) throw error
  // No revalidatePath — router.refresh() in component
}

async function assertAssignedIfAssociate(supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'], entryId: string, userId: string) {
  const { data: userRow } = await supabase.from('users').select('role').eq('id', userId).single()
  if (userRow?.role !== 'associate') return
  const { data } = await supabase
    .from('pipeline_entry_assignees')
    .select('user_id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new UserFacingError('Associates can only move entries assigned to them.')
}

export async function moveEntry(entryId: string, stageId: string | null) {
  const { supabase, userId } = await requireAuth()
  await assertAssignedIfAssociate(supabase, entryId, userId)
  const { data: current } = await supabase.from('pipeline_entries').select('stage_id').eq('id', entryId).single()
  await supabase.from('pipeline_entries').update({ stage_id: stageId }).eq('id', entryId)
  await supabase.from('pipeline_entry_stage_history').insert({
    entry_id: entryId,
    from_stage_id: current?.stage_id ?? null,
    to_stage_id: stageId,
    moved_by: userId,
  })
}

export async function getEntryStageHistory(entryId: string) {
  const { supabase } = await requireAuth()
  const { data } = await supabase
    .from('pipeline_entry_stage_history')
    .select('id, from_stage_id, to_stage_id, moved_by, moved_at, from_stage:pipeline_stages!from_stage_id(name), to_stage:pipeline_stages!to_stage_id(name)')
    .eq('entry_id', entryId)
    .order('moved_at', { ascending: true })
  return (data ?? []).map((row: any) => ({
    id: row.id,
    from_stage: row.from_stage ? { name: Array.isArray(row.from_stage) ? row.from_stage[0]?.name : row.from_stage.name } : null,
    to_stage: row.to_stage ? { name: Array.isArray(row.to_stage) ? row.to_stage[0]?.name : row.to_stage.name } : null,
    moved_at: row.moved_at,
  }))
}

export async function deleteEntry(entryId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('pipeline_entries').delete().eq('id', entryId)
  if (error) throw error
}

export async function addAssignee(entryId: string, userId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('pipeline_entry_assignees').insert({ entry_id: entryId, user_id: userId })
}

export async function removeAssignee(entryId: string, userId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('pipeline_entry_assignees').delete().eq('entry_id', entryId).eq('user_id', userId)
}

export async function rejectEntry(entryId: string, stageId: string, reason: string) {
  const { supabase, userId } = await requireAuth()
  await assertAssignedIfAssociate(supabase, entryId, userId)
  await supabase.from('pipeline_entries').update({ stage_id: stageId, rejection_reason: reason.trim() || null }).eq('id', entryId)
}

// ── Stage questions (custom stages) ──────────────────────────────────────────

type StageQuestionItem = {
  id?: string
  label: string
  field_type: StageQuestionFieldType
  required: boolean
  position: number
}

// Replace a stage's question set: update existing by id, insert new, delete removed.
// Kept questions retain their answers.
export async function saveStageQuestions(stageId: string, items: StageQuestionItem[]) {
  const { supabase, orgId } = await requireAdmin()

  const { data: existing } = await supabase
    .from('pipeline_stage_questions')
    .select('id')
    .eq('stage_id', stageId)
  const existingIds = new Set((existing ?? []).map((r: any) => r.id as string))
  const keptIds = new Set(items.filter((i) => i.id).map((i) => i.id as string))

  // Delete removed
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id))
  if (toDelete.length > 0) {
    await supabase.from('pipeline_stage_questions').delete().in('id', toDelete)
  }

  // Update existing
  for (const it of items.filter((i) => i.id)) {
    await supabase
      .from('pipeline_stage_questions')
      .update({ label: it.label.trim(), field_type: it.field_type, required: it.required, position: it.position })
      .eq('id', it.id!)
  }

  // Insert new
  const toInsert = items.filter((i) => !i.id)
  if (toInsert.length > 0) {
    const { error } = await supabase.from('pipeline_stage_questions').insert(
      toInsert.map((it) => ({
        stage_id: stageId,
        org_id: orgId,
        label: it.label.trim(),
        field_type: it.field_type,
        required: it.required,
        position: it.position,
      }))
    )
    if (error) throw error
  }
}

async function upsertStageAnswers(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  entryId: string,
  orgId: string | null,
  answers: Array<{ questionId: string; value: string }>,
) {
  if (answers.length === 0) return
  const now = new Date().toISOString()
  const rows = answers.map((a) => ({
    entry_id: entryId,
    question_id: a.questionId,
    org_id: orgId,
    value: a.value.trim() || null,
    updated_at: now,
  }))
  const { error } = await supabase
    .from('pipeline_entry_stage_answers')
    .upsert(rows, { onConflict: 'entry_id,question_id' })
  if (error) throw error
}

// Move an entry into a stage AND record its stage answers in one shot.
export async function moveEntryWithStageAnswers(
  entryId: string,
  stageId: string,
  answers: Array<{ questionId: string; value: string }>,
) {
  const { supabase, userId, orgId } = await requireAuth()
  await assertAssignedIfAssociate(supabase, entryId, userId)
  const { data: current } = await supabase.from('pipeline_entries').select('stage_id').eq('id', entryId).single()
  await supabase.from('pipeline_entries').update({ stage_id: stageId }).eq('id', entryId)
  await supabase.from('pipeline_entry_stage_history').insert({
    entry_id: entryId,
    from_stage_id: current?.stage_id ?? null,
    to_stage_id: stageId,
    moved_by: userId,
  })
  await upsertStageAnswers(supabase, entryId, orgId, answers)
}

// Edit answers later (admins) without moving.
export async function saveEntryStageAnswers(
  entryId: string,
  answers: Array<{ questionId: string; value: string }>,
) {
  const { supabase, orgId } = await requireAdmin()
  await upsertStageAnswers(supabase, entryId, orgId, answers)
}

export async function getEntryStageAnswers(entryId: string) {
  const { supabase } = await requireAuth()
  const { data } = await supabase
    .from('pipeline_entry_stage_answers')
    .select('value, question:pipeline_stage_questions(id, label, field_type, position, stage_id, stage:pipeline_stages(name))')
    .eq('entry_id', entryId)
  const rows = (data ?? []).map((row: any) => {
    const q = Array.isArray(row.question) ? row.question[0] : row.question
    const stage = q && (Array.isArray(q.stage) ? q.stage[0] : q.stage)
    return {
      question_id: q?.id as string,
      label: q?.label as string,
      field_type: q?.field_type as StageQuestionFieldType,
      value: (row.value ?? null) as string | null,
      stage_id: q?.stage_id as string,
      stage_name: (stage?.name ?? 'Stage') as string,
      position: (q?.position ?? 0) as number,
    }
  })
  rows.sort((a, b) => a.stage_name.localeCompare(b.stage_name) || a.position - b.position)
  return rows.map(({ position, ...r }) => r)
}

export async function getEntryAnswers(entryId: string) {
  const { supabase } = await requireAuth()
  const { data } = await supabase
    .from('pipeline_entry_answers')
    .select('id, node_id, answer_text, node:form_nodes(question_text, answer_type)')
    .eq('entry_id', entryId)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    node_id: row.node_id,
    answer_text: row.answer_text ?? null,
    node: Array.isArray(row.node) ? (row.node[0] ?? null) : (row.node ?? null),
  })) as Array<{
    id: string
    node_id: string
    answer_text: string | null
    node: { question_text: string | null; answer_type: string | null } | null
  }>
}
