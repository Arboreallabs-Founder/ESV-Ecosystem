'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireInternal() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!data || !['founder', 'admin', 'associate'].includes(data.role)) throw new Error('Forbidden')
  return supabase
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!data || !['founder', 'admin'].includes(data.role)) throw new Error('Forbidden')
  return { supabase, userId: user.id }
}

export async function createPipeline(name: string, description: string) {
  const { supabase, userId } = await requireAdmin()
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ name: name.trim(), description: description.trim() || null, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  // Seed with a default stage
  await supabase.from('pipeline_stages').insert({
    pipeline_id: data.id,
    name: 'New',
    color: '#745FFD',
    position: 0,
  })
  // No revalidatePath — router.refresh() in component
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
  await requireInternal()
  const supabase = await createClient()
  await supabase.from('pipeline_entries').update({ stage_id: stageId }).eq('id', entryId)
  // Optimistic update in component handles UI
}

export async function deleteEntry(entryId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('pipeline_entries').delete().eq('id', entryId)
  if (error) throw error
}

export async function assignEntry(entryId: string, userId: string | null) {
  const { supabase } = await requireAdmin()
  await supabase.from('pipeline_entries').update({ assigned_to: userId }).eq('id', entryId)
}

export async function getEntryAnswers(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data } = await supabase
    .from('pipeline_entry_answers')
    .select('id, node_id, answer_text, node:form_nodes(question_text, answer_type)')
    .eq('entry_id', entryId)
  return (data ?? []) as Array<{
    id: string
    node_id: string
    answer_text: string | null
    node: { question_text: string | null; answer_type: string | null } | null
  }>
}
