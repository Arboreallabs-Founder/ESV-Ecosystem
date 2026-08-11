'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, requireAuth } from '@/lib/guards'
import type { FormNode, FormEdge } from '@/lib/types'

async function requireAdmin() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin'])
  return { supabase, userId, orgId }
}

// Building/linking forms is also open to associates (RLS on forms/form_nodes/form_edges/
// form_links already allows them) — only deleting a form or a link stays admin-only.
async function requireBuilder() {
  const { supabase, userId, orgId } = await requireRole(['founder', 'admin', 'associate'])
  return { supabase, userId, orgId }
}

export async function createForm(title: string, description: string, pipelineId: string | null) {
  const { supabase, userId, orgId } = await requireBuilder()
  const { data: form, error } = await supabase
    .from('forms')
    .insert({
      title: title.trim(),
      description: description.trim() || null,
      pipeline_id: pipelineId || null,
      created_by: userId,
      org_id: orgId,
    })
    .select('id')
    .single()
  if (error) throw error

  // Seed with start + two end nodes (success + rejected)
  await supabase
    .from('form_nodes')
    .insert({ form_id: form.id, type: 'start', position_x: 300, position_y: 50 })
  await supabase
    .from('form_nodes')
    .insert({ form_id: form.id, type: 'end', subtype: 'success', position_x: 150, position_y: 500 })
  await supabase
    .from('form_nodes')
    .insert({ form_id: form.id, type: 'end', subtype: 'rejected', position_x: 450, position_y: 500 })

  return form.id
}

export async function updateFormMeta(
  formId: string,
  title: string,
  description: string,
  pipelineId: string | null,
  displayName: string,
) {
  const { supabase } = await requireBuilder()
  const { error } = await supabase
    .from('forms')
    .update({
      title: title.trim(),
      // Blank means "use the title" rather than "show nothing", so it is stored as NULL and the
      // fallback lives in one place instead of being an empty header on the public page.
      display_name: displayName.trim() || null,
      description: description.trim() || null,
      pipeline_id: pipelineId || null,
    })
    .eq('id', formId)
  if (error) throw error
}

export async function saveFormGraph(
  formId: string,
  nodes: Array<{
    id: string
    type: 'start' | 'end' | 'question'
    subtype: 'success' | 'rejected' | null
    position_x: number
    position_y: number
    question_text: string | null
    answer_type: 'short_text' | 'long_text' | 'mcq' | null
    options: Array<{ id: string; label: string; position: number }>
  }>,
  edges: Array<{
    id: string
    source_node_id: string
    target_node_id: string
    condition_value: string | null
    condition_label: string | null
  }>,
) {
  const { supabase } = await requireBuilder()

  // Replace all nodes, edges, and options: delete edges and nodes (CASCADE deletes options)
  await supabase.from('form_edges').delete().eq('form_id', formId)
  await supabase.from('form_nodes').delete().eq('form_id', formId)

  if (nodes.length > 0) {
    const { error: nodeErr } = await supabase.from('form_nodes').insert(
      nodes.map(n => ({
        id: n.id,
        form_id: formId,
        type: n.type,
        subtype: n.subtype ?? null,
        position_x: n.position_x,
        position_y: n.position_y,
        question_text: n.question_text,
        answer_type: n.answer_type,
      }))
    )
    if (nodeErr) throw nodeErr

    const allOptions = nodes.flatMap(n => n.options.map(o => ({ id: o.id, node_id: n.id, label: o.label, position: o.position })))
    if (allOptions.length > 0) {
      await supabase.from('form_node_options').insert(allOptions)
    }
  }

  if (edges.length > 0) {
    const { error: edgeErr } = await supabase.from('form_edges').insert(
      edges.map(e => ({ id: e.id, form_id: formId, source_node_id: e.source_node_id, target_node_id: e.target_node_id, condition_value: e.condition_value, condition_label: e.condition_label }))
    )
    if (edgeErr) throw edgeErr
  }
}

export async function publishForm(formId: string, published: boolean) {
  const { supabase } = await requireBuilder()
  const { error } = await supabase.from('forms').update({ published }).eq('id', formId)
  if (error) throw error
}

export async function generateFormLink(formId: string, label: string) {
  const { supabase, userId } = await requireAuth()
  const { data, error } = await supabase
    .from('form_links')
    .insert({ form_id: formId, created_by: userId, label: label.trim() || null })
    .select('id, token')
    .single()
  if (error) throw error
  const { data: userRow } = await supabase.from('users').select('name').eq('id', userId).single()
  return { token: data.token, id: data.id, creatorName: userRow?.name ?? null }
}

export async function getPartnerFormLinks() {
  const { supabase, userId } = await requireAuth()
  const { data } = await supabase
    .from('form_links')
    .select('id, token, label, created_at, form:forms(id, title, pipeline:pipelines(name))')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((l: any) => ({
    id: l.id as string,
    token: l.token as string,
    label: l.label as string | null,
    created_at: l.created_at as string,
    form: l.form ? { id: l.form.id, title: l.form.title } : null,
    pipeline: l.form?.pipeline ?? null,
  }))
}

export async function deleteForm(formId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('forms').delete().eq('id', formId)
  if (error) throw error
}

export async function deleteFormLink(linkId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('form_links').delete().eq('id', linkId)
  if (error) throw error
}

export async function linkFormToPipeline(formId: string, pipelineId: string | null) {
  const { supabase } = await requireBuilder()
  const { error } = await supabase.from('forms').update({ pipeline_id: pipelineId }).eq('id', formId)
  if (error) throw error

  if (!pipelineId) return

  // Find the lead stage of the target pipeline
  const { data: leadStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .eq('stage_type', 'lead')
    .single()

  if (!leadStage) return

  // Find all existing entries for this form from other pipelines
  const { data: existingEntries } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitter_name, submitter_email, form_link_id')
    .eq('form_id', formId)
    .neq('pipeline_id', pipelineId)

  if (!existingEntries || existingEntries.length === 0) return

  // Exclude form_link_ids already present in the target pipeline
  const { data: alreadyLinked } = await supabase
    .from('pipeline_entries')
    .select('form_link_id')
    .eq('pipeline_id', pipelineId)
    .eq('form_id', formId)

  const linkedTokens = new Set((alreadyLinked ?? []).map((e: any) => e.form_link_id))
  const toImport = existingEntries.filter((e: any) => !linkedTokens.has(e.form_link_id))

  if (toImport.length === 0) return

  // Create entries in the lead stage
  const { data: newEntries } = await supabase
    .from('pipeline_entries')
    .insert(
      toImport.map((e: any) => ({
        pipeline_id: pipelineId,
        form_id: formId,
        form_link_id: e.form_link_id,
        stage_id: leadStage.id,
        title: e.title,
        submitter_name: e.submitter_name,
        submitter_email: e.submitter_email,
      }))
    )
    .select('id, form_link_id')

  if (!newEntries || newEntries.length === 0) return

  // Copy answers for each new entry
  for (const newEntry of newEntries) {
    const source = toImport.find((e: any) => e.form_link_id === newEntry.form_link_id)
    if (!source) continue
    const { data: answers } = await supabase
      .from('pipeline_entry_answers')
      .select('node_id, answer_text')
      .eq('entry_id', source.id)
    if (answers && answers.length > 0) {
      await supabase.from('pipeline_entry_answers').insert(
        answers.map((a: any) => ({ entry_id: newEntry.id, node_id: a.node_id, answer_text: a.answer_text }))
      )
    }
  }
}

// Public submission — called from /f/[token] page (no auth required)
export async function submitForm(
  linkId: string,
  formId: string,
  pipelineId: string | null,
  firstStageId: string | null,
  answers: Array<{ node_id: string; answer_text: string }>,
  submitterName: string,
  submitterEmail: string,
) {
  const supabase = await createClient() // runs as anon role

  if (!pipelineId) return // form not linked to a pipeline — nothing to record

  // Submission goes through a SECURITY DEFINER RPC: anon can't satisfy the pipeline_entries
  // RLS WITH CHECK directly (it joins `forms`, which anon can't read), and the insert's
  // RETURNING needs a SELECT policy anon lacks. The RPC validates server-side and bypasses RLS.
  const { error } = await supabase.rpc('submit_form_entry', {
    p_link_id: linkId,
    p_form_id: formId,
    p_pipeline_id: pipelineId,
    p_first_stage_id: firstStageId,
    p_answers: answers,
    p_submitter_name: submitterName || '',
    p_submitter_email: submitterEmail || '',
  })
  if (error) throw error
}
