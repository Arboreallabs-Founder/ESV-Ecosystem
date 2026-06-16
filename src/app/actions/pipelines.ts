'use server'

import { revalidatePath } from 'next/cache'
import { requireRole, requireAuth } from '@/lib/guards'

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
  const { error } = await supabase.from('pipeline_stages').insert({
    pipeline_id: pipelineId, name: name.trim(), color, position,
  })
  if (error) throw error
  // No revalidatePath — router.refresh() in component
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

export async function moveEntry(entryId: string, stageId: string | null) {
  const { supabase, userId } = await requireAuth()
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
  const { supabase } = await requireAuth()
  await supabase.from('pipeline_entries').update({ stage_id: stageId, rejection_reason: reason.trim() || null }).eq('id', entryId)
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
