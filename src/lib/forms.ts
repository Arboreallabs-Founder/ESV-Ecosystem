import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Form, FormNode, FormEdge, FormLink } from './types'

export const fetchForms = cache(async (): Promise<Form[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('forms')
    .select('*, pipeline:pipelines(name), links:form_links(id, label, created_at, creator:users!created_by(name))')
    .order('created_at', { ascending: false })
  return (data ?? []).map((f: any) => ({
    ...f,
    pipeline: f.pipeline ?? null,
    links: (f.links ?? []).map((l: any) => ({ ...l, creator: l.creator ?? null }))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }))
})

export const fetchFormForBuilder = cache(async (id: string): Promise<{
  form: Form
  nodes: FormNode[]
  edges: FormEdge[]
} | null> => {
  const supabase = await createClient()
  const [{ data: form }, { data: nodes }, { data: edges }, { data: options }] = await Promise.all([
    supabase.from('forms').select('*, pipeline:pipelines(name)').eq('id', id).single(),
    supabase.from('form_nodes').select('*').eq('form_id', id),
    supabase.from('form_edges').select('*').eq('form_id', id),
    supabase.from('form_node_options').select('*').order('position', { ascending: true }),
  ])
  if (!form) return null

  const optionsByNode: Record<string, NonNullable<typeof options>> = {}
  for (const o of options ?? []) {
    if (!optionsByNode[o.node_id]) optionsByNode[o.node_id] = []
    optionsByNode[o.node_id]!.push(o)
  }

  return {
    form: { ...form, pipeline: form.pipeline ?? null },
    nodes: (nodes ?? []).map((n) => ({ ...n, options: optionsByNode[n.id] ?? [] })),
    edges: edges ?? [],
  }
})

export const fetchFormLinks = cache(async (formId: string): Promise<FormLink[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('form_links')
    .select('*, creator:users(name)')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((l: any) => ({ ...l, creator: l.creator ?? null }))
})
