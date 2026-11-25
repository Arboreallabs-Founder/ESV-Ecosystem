'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole, requireAuth } from '@/lib/guards'
import type { StageQuestionFieldType } from '@/lib/types'

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

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
  if (error) throw dbFailure('save that', error)
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
  if (error) throw dbFailure('save that', error)
  // No revalidatePath — router.refresh() in component
}

export async function deletePipeline(id: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('pipelines').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/pipelines')
}

export async function addStage(pipelineId: string, name: string, color: string, position: number) {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('pipeline_stages').insert({
    pipeline_id: pipelineId, name: name.trim(), color, position,
  }).select('id').single()
  if (error) throw dbFailure('save that', error)
  // No revalidatePath — router.refresh() in component
  return data.id as string
}

export async function updateStage(stageId: string, name: string, color: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('pipeline_stages')
    .update({ name: name.trim(), color })
    .eq('id', stageId)
  if (error) throw dbFailure('save that', error)
  // No revalidatePath — router.refresh() in component
}

export async function deleteStage(stageId: string) {
  const { supabase } = await requireAdmin()
  // Move entries to null stage first
  await supabase.from('pipeline_entries').update({ stage_id: null }).eq('stage_id', stageId)
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId)
  if (error) throw dbFailure('save that', error)
  // No revalidatePath — router.refresh() in component
}

async function assertAssignedIfAssociate(supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'], entryId: string, userId: string) {
  const { data: userRow } = await supabase.from('users').select('role').eq('id', userId).single()
  // hr and general reach a pipeline's entries only where recruitment lets them (20261130000000).
  if (!['associate', 'hr', 'general'].includes(userRow?.role ?? '')) return
  const { data } = await supabase
    .from('pipeline_entry_assignees')
    .select('user_id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new UserFacingError('You can only move entries assigned to you.')
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
  if (error) throw dbFailure('save that', error)
}

/** Founders/admins assign anyone; an associate may add or remove only themselves (2026-10-29),
    which is also what lets them move the entry, since moves need you to be on it. */
async function requireAssigneeChange(targetUserId: string) {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  if (ctx.role === 'associate' && targetUserId !== ctx.userId) {
    throw new UserFacingError('Associates can assign or unassign only themselves.')
  }
  return ctx
}

export async function addAssignee(entryId: string, userId: string) {
  const { supabase } = await requireAssigneeChange(userId)
  const { error } = await supabase.from('pipeline_entry_assignees').insert({ entry_id: entryId, user_id: userId })
  if (error && error.code !== '23505') throw dbFailure('assign that', error)
}

export async function removeAssignee(entryId: string, userId: string) {
  const { supabase } = await requireAssigneeChange(userId)
  const { error } = await supabase.from('pipeline_entry_assignees').delete().eq('entry_id', entryId).eq('user_id', userId)
  if (error) throw dbFailure('unassign that', error)
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
    if (error) throw dbFailure('save that', error)
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
  if (error) throw dbFailure('save that', error)
}

// Move an entry into a stage AND record its stage answers in one shot.
// ── Automatic stage tasks (20261017000000) ──────────────────────────────────

type StageTaskItem = {
  id?: string
  title: string
  assign_to: 'assignees' | 'mover' | 'user' | 'investor_relations' | 'recruitment'
  user_id: string | null
  due_days: number
  priority: 'Low' | 'Medium' | 'High'
  position: number
}

/** Replace a stage's task templates: update kept ones by id, insert new, delete removed. Tasks
    already raised from a removed template stay on people's boards. */
export async function saveStageTasks(stageId: string, items: StageTaskItem[]) {
  const { supabase, orgId } = await requireAdmin()
  for (const t of items) {
    if (!t.title.trim()) throw new UserFacingError('Every automatic task needs a title.')
    if (t.assign_to === 'user' && !t.user_id) throw new UserFacingError(`Pick who "${t.title.trim()}" goes to.`)
  }
  const { data: existing, error: readErr } = await supabase.from('pipeline_stage_tasks').select('id').eq('stage_id', stageId)
  if (readErr) throw dbFailure('load the stage tasks', readErr)
  const keep = new Set(items.filter((t) => t.id).map((t) => t.id as string))
  const remove = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id))
  if (remove.length) {
    const { error } = await supabase.from('pipeline_stage_tasks').delete().in('id', remove)
    if (error) throw dbFailure('remove stage tasks', error)
  }
  if (items.length) {
    const { error } = await supabase.from('pipeline_stage_tasks').upsert(items.map((t) => ({
      id: t.id ?? crypto.randomUUID(),
      stage_id: stageId,
      org_id: orgId,
      title: t.title.trim(),
      assign_to: t.assign_to,
      user_id: t.assign_to === 'user' ? t.user_id : null,
      due_days: Math.max(0, Math.min(365, Math.round(t.due_days || 0))),
      priority: t.priority,
      position: t.position,
    })), { onConflict: 'id' })
    if (error) throw dbFailure('save the stage tasks', error)
  }
}

/** The tasks an entry's stages have raised, newest first, for the entry detail. */
export async function getEntryTasks(entryId: string) {
  const { supabase } = await requireAuth()
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, assignee:users!assignee_id(name, photo_url)')
    .eq('pipeline_entry_id', entryId)
    .eq('source', 'pipeline')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[pipelines] entry tasks read failed:', error.message)
    return []
  }
  type Row = { id: string; title: string; status: string; due_date: string | null; assignee: { name: string | null; photo_url: string | null } | Array<{ name: string | null; photo_url: string | null }> | null }
  return ((data ?? []) as unknown as Row[]).map((t) => ({ ...t, assignee: one(t.assignee) }))
}

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
    .select('id, node_id, answer_text, question_text, node:form_nodes(question_text, answer_type, position_y)')
    .eq('entry_id', entryId)
  type AnswerRow = {
    id: string; node_id: string | null; answer_text: string | null; question_text: string | null
    node: AnswerNode | AnswerNode[] | null
  }
  type AnswerNode = { question_text: string | null; answer_type: string | null; position_y: number | null }
  return ((data ?? []) as unknown as AnswerRow[])
    // In the order the form asks them, rather than whatever order the rows came back in.
    .sort((a, b) => ((one(a.node)?.position_y ?? 0) - (one(b.node)?.position_y ?? 0)))
    .map((row) => {
      const node = one(row.node)
      return {
        id: row.id,
        node_id: row.node_id,
        answer_text: row.answer_text ?? null,
        // A question since removed from the form still shows, by the wording saved with the answer
        // (20261016000000).
        node: node
          ? { question_text: node.question_text ?? row.question_text ?? null, answer_type: node.answer_type ?? null }
          : { question_text: row.question_text ?? null, answer_type: null },
      }
    }) as Array<{
    id: string
    node_id: string
    answer_text: string | null
    node: { question_text: string | null; answer_type: string | null } | null
  }>
}

// ── Server-checked create & move (used by the AI connector) ───────────────────
//
// The board enforces its move rules in the browser (PipelineBoardClient: assignee gate, rejection
// reason, Accepted → acceptance flow, stage questions). moveEntry() itself checks none of them, so
// anything that isn't the board — the AI connector first — goes through moveEntryChecked() instead,
// which enforces the same rules here. Stage automations are a database trigger on stage_id, so they
// fire exactly as they do for a drag.

type StageRow = { id: string; name: string; pipeline_id: string; stage_type: string | null; position: number }

export type CreateEntryInput = {
  pipeline_id: string
  title: string
  stage_id?: string | null
  company_id?: string | null
  submitter_name?: string | null
  submitter_email?: string | null
  /** Who's on it. Defaults to the caller. Associates may only put themselves. */
  assignee_ids?: string[]
}

/** Create a pipeline entry by hand (until now entries only came from form submissions). */
export async function createEntry(input: CreateEntryInput): Promise<string> {
  const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate'])
  const title = input.title?.trim()
  if (!title) throw new UserFacingError('A title is required.')
  if (title.length > 200) throw new UserFacingError('The title must be at most 200 characters.')

  const { data: pipeline } = await supabase.from('pipelines').select('id').eq('id', input.pipeline_id).maybeSingle()
  if (!pipeline) throw new UserFacingError('pipeline_id is not a pipeline you can see.')

  const { data: stageRows, error: stageErr } = await supabase
    .from('pipeline_stages').select('id, name, pipeline_id, stage_type, position').eq('pipeline_id', input.pipeline_id)
  if (stageErr) throw dbFailure('read the pipeline stages', stageErr)
  const stages = (stageRows ?? []) as StageRow[]
  let stage: StageRow | undefined
  if (input.stage_id) {
    stage = stages.find((s) => s.id === input.stage_id)
    if (!stage) throw new UserFacingError('stage_id does not belong to this pipeline.')
  } else {
    stage = stages.find((s) => s.stage_type === 'lead') ?? [...stages].sort((a, b) => a.position - b.position)[0]
    if (!stage) throw new UserFacingError('This pipeline has no stages.')
  }
  if (stage.stage_type === 'accepted') throw new UserFacingError('An entry cannot be created straight into Accepted. Create it in an earlier stage, then accept it on the board (or use create_deal for an off-pipeline deal).')
  if (stage.stage_type === 'rejected') throw new UserFacingError('An entry cannot be created straight into Rejected.')

  const assignees = Array.from(new Set(input.assignee_ids?.length ? input.assignee_ids : [userId]))
  if (role === 'associate' && assignees.some((id) => id !== userId)) {
    throw new UserFacingError('Associates can assign only themselves.')
  }

  if (input.company_id) {
    const { data: company } = await supabase.from('companies').select('id').eq('id', input.company_id).maybeSingle()
    if (!company) throw new UserFacingError('company_id is not a company you can see.')
  }

  // Created stage-less, assigned, then moved into its stage: the stage automation then hands
  // "assignees" tasks straight to the people on it, exactly like a card that is assigned and dragged.
  const { data: entry, error } = await supabase
    .from('pipeline_entries')
    .insert({
      pipeline_id: input.pipeline_id,
      stage_id: null,
      title,
      company_id: input.company_id ?? null,
      submitter_name: input.submitter_name?.trim() || null,
      submitter_email: input.submitter_email?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw dbFailure('create the entry', error)
  const entryId = entry.id as string

  if (assignees.length) {
    const { error: aErr } = await supabase.from('pipeline_entry_assignees').insert(assignees.map((u) => ({ entry_id: entryId, user_id: u })))
    if (aErr) throw dbFailure('assign the entry', aErr)
  }
  const { error: mErr } = await supabase.from('pipeline_entries').update({ stage_id: stage.id }).eq('id', entryId)
  if (mErr) throw dbFailure('place the entry in its stage', mErr)
  await supabase.from('pipeline_entry_stage_history').insert({ entry_id: entryId, from_stage_id: null, to_stage_id: stage.id, moved_by: userId })

  revalidatePath(`/pipelines/${input.pipeline_id}`)
  return entryId
}

/**
 * Move an entry to a stage with the board's rules enforced server-side:
 *  - the stage must be in the entry's pipeline
 *  - associates may move only entries they're assigned to; nobody may move an unassigned entry
 *  - Rejected needs a reason
 *  - Accepted is refused (it creates an Active Deal and needs deal categories — the board does it),
 *    except moving an already-accepted entry back, which the board also allows without the flow
 *  - a stage with required questions needs answers
 */
export async function moveEntryChecked(
  entryId: string,
  stageId: string,
  opts: { reason?: string | null; answers?: Array<{ questionId: string; value: string }> } = {},
): Promise<void> {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin', 'associate'])

  const { data: entry } = await supabase
    .from('pipeline_entries')
    .select('id, pipeline_id, stage_id, assignees:pipeline_entry_assignees(user_id), active_deals(id)')
    .eq('id', entryId)
    .maybeSingle()
  if (!entry) throw new UserFacingError('entry_id is not an entry you can see.')
  const e = entry as unknown as { pipeline_id: string; stage_id: string | null; assignees: Array<{ user_id: string }>; active_deals: Array<{ id: string }> | { id: string } | null }

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, name, pipeline_id, stage_type, questions:pipeline_stage_questions(id, label, field_type, required)')
    .eq('id', stageId)
    .maybeSingle()
  if (!stage || (stage as { pipeline_id: string }).pipeline_id !== e.pipeline_id) {
    throw new UserFacingError('stage_id does not belong to this pipeline.')
  }
  const s = stage as unknown as StageRow & { questions: Array<{ id: string; label: string; field_type: string; required: boolean }> }
  if (e.stage_id === s.id) throw new UserFacingError(`The entry is already in ${s.name}.`)

  await assertAssignedIfAssociate(supabase, entryId, userId)
  if ((e.assignees ?? []).length === 0) throw new UserFacingError('Assign someone to this entry before moving it.')

  const hasDeal = Array.isArray(e.active_deals) ? e.active_deals.length > 0 : !!e.active_deals
  if (s.stage_type === 'accepted' && !hasDeal) {
    throw new UserFacingError('Accepting creates an Active Deal and needs its deal categories, so it is done on the pipeline board in Ecosystem.')
  }

  const patch: Record<string, unknown> = { stage_id: s.id }
  if (s.stage_type === 'rejected') {
    const reason = opts.reason?.trim()
    if (!reason) throw new UserFacingError('Moving to Rejected needs a reason.')
    if (reason.length > 1000) throw new UserFacingError('The reason must be at most 1000 characters.')
    patch.rejection_reason = reason
  }

  const answers = opts.answers ?? []
  const questions = s.questions ?? []
  for (const a of answers) {
    if (!questions.some((q) => q.id === a.questionId)) throw new UserFacingError(`Question ${a.questionId} is not on stage ${s.name}.`)
  }
  for (const q of questions.filter((x) => x.required && x.field_type !== 'boolean')) {
    const v = answers.find((a) => a.questionId === q.id)?.value?.trim()
    if (!v) throw new UserFacingError(`Stage ${s.name} needs an answer to "${q.label}" (question_id ${q.id}).`)
  }

  const { data: moved, error } = await supabase.from('pipeline_entries').update(patch).eq('id', entryId).select('id')
  if (error) throw dbFailure('move the entry', error)
  if (!moved || moved.length === 0) throw new UserFacingError('That entry could not be moved — you may not have permission.')
  await supabase.from('pipeline_entry_stage_history').insert({ entry_id: entryId, from_stage_id: e.stage_id, to_stage_id: s.id, moved_by: userId })
  if (answers.length) await upsertStageAnswers(supabase, entryId, orgId, answers)

  revalidatePath(`/pipelines/${e.pipeline_id}`)
}