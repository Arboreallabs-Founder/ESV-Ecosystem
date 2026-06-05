import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Pipeline, PipelineEntry, PipelineEntryAnswer } from './types'

export const fetchPipelines = cache(async (): Promise<Pipeline[]> => {
  const supabase = await createClient()
  const [{ data: pipelines }, { data: stages }, { data: counts }] = await Promise.all([
    supabase.from('pipelines').select('*').order('created_at', { ascending: true }),
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
    supabase.from('pipeline_entries').select('pipeline_id'),
  ])

  return (pipelines ?? []).map((p) => ({
    ...p,
    stages: (stages ?? []).filter((s) => s.pipeline_id === p.id),
    entry_count: (counts ?? []).filter((e) => e.pipeline_id === p.id).length,
  }))
})

export const fetchPipeline = cache(async (id: string): Promise<Pipeline | null> => {
  const supabase = await createClient()
  const [{ data: p }, { data: stages }, { data: counts }] = await Promise.all([
    supabase.from('pipelines').select('*').eq('id', id).single(),
    supabase.from('pipeline_stages').select('*').eq('pipeline_id', id).order('position', { ascending: true }),
    supabase.from('pipeline_entries').select('pipeline_id').eq('pipeline_id', id),
  ])
  if (!p) return null
  return { ...p, stages: stages ?? [], entry_count: (counts ?? []).length }
})

export const fetchPipelineEntries = cache(async (pipelineId: string): Promise<PipelineEntry[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pipeline_entries')
    .select('*, form:forms(title), form_link:form_links(created_by, users(name)), assignees:pipeline_entry_assignees(user_id, user:users(name))')
    .eq('pipeline_id', pipelineId)
    .order('submitted_at', { ascending: false })

  return (data ?? []).map((e: any) => ({
    ...e,
    form: e.form ?? null,
    link_creator: e.form_link?.users ?? null,
    assignees: (e.assignees ?? []).map((a: any) => ({ user_id: a.user_id, name: a.user?.name ?? 'Unknown' })),
  }))
})

export const fetchEntryWithAnswers = cache(async (entryId: string): Promise<{ entry: PipelineEntry; answers: PipelineEntryAnswer[] } | null> => {
  const supabase = await createClient()
  const [{ data: entry }, { data: answers }] = await Promise.all([
    supabase.from('pipeline_entries').select('*, form:forms(title)').eq('id', entryId).single(),
    supabase.from('pipeline_entry_answers')
      .select('*, node:form_nodes(question_text, answer_type)')
      .eq('entry_id', entryId),
  ])
  if (!entry) return null
  return {
    entry: { ...entry, form: entry.form ?? null, link_creator: null },
    answers: answers ?? [],
  }
})
