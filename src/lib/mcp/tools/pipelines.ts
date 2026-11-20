import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { createEntry, moveEntryChecked, getEntryAnswers, getEntryStageAnswers, getEntryStageHistory, getEntryTasks } from '@/app/actions/pipelines'
import { createCompany, findSimilarCompanies, addUpdate } from '@/app/actions/companies'
import { INTERNAL, ok, refuse, run, uuid, shortText, pageArgs, one } from './shared'

type Supa = Awaited<ReturnType<typeof requireRole>>['supabase']

/**
 * company_id as given, or a company created from company_name after the duplicate check.
 * Returns a tool result instead when duplicates block the create (so the caller can return it).
 */
export async function resolveCompany(args: { company_id?: string; company_name?: string; force?: boolean }): Promise<{ companyId: string | null } | { result: CallToolResult }> {
  if (args.company_id && args.company_name) return { result: refuse('Pass company_id or company_name, not both.') }
  if (args.company_id) return { companyId: args.company_id }
  if (!args.company_name) return { companyId: null }
  if (!args.force) {
    const similar = await findSimilarCompanies(args.company_name)
    if (similar.length) {
      return {
        result: ok({
          created: false,
          message: 'Nothing was created: companies with similar names exist. Pass one as company_id, or call again with force=true to create a new company.',
          possible_duplicates: similar,
        }),
      }
    }
  }
  return { companyId: await createCompany({ name: args.company_name }) }
}

const ENTRY_SELECT = 'id, title, pipeline_id, stage_id, company_id, submitter_name, submitter_email, submitted_at, rejection_reason, pipeline:pipelines(name), stage:pipeline_stages(name, stage_type), company:companies(id, name), assignees:pipeline_entry_assignees(user_id, user:users(name)), active_deals(id, deal_state)'

type EntryRow = {
  id: string; title: string | null; pipeline_id: string; stage_id: string | null; company_id: string | null
  submitter_name: string | null; submitter_email: string | null; submitted_at: string; rejection_reason: string | null
  pipeline: unknown; stage: unknown; company: unknown; assignees: Array<{ user_id: string; user: unknown }> | null; active_deals: unknown
}

function shapeEntry(e: EntryRow) {
  const deal = one(e.active_deals as { id: string; deal_state: string } | Array<{ id: string; deal_state: string }> | null)
  return {
    id: e.id,
    title: e.title,
    pipeline: { id: e.pipeline_id, name: one(e.pipeline as { name: string } | null)?.name ?? null },
    stage: e.stage_id ? { id: e.stage_id, ...(one(e.stage as { name: string; stage_type: string | null } | null) ?? {}) } : null,
    company: one(e.company as { id: string; name: string } | null),
    submitter: { name: e.submitter_name, email: e.submitter_email },
    submitted_at: e.submitted_at,
    rejection_reason: e.rejection_reason,
    assignees: (e.assignees ?? []).map((a) => ({ user_id: a.user_id, name: one(a.user as { name: string | null } | null)?.name ?? null })),
    deal: deal ? { deal_id: deal.id, state: deal.deal_state } : null,
  }
}

async function readEntry(supabase: Supa, entryId: string) {
  const { data, error } = await supabase.from('pipeline_entries').select(ENTRY_SELECT).eq('id', entryId).maybeSingle()
  if (error) throw error
  return data ? shapeEntry(data as unknown as EntryRow) : null
}

/** The entry with everything around it: answers, stage answers, history and linked tasks. */
export async function readEntryFull(supabase: Supa, entryId: string) {
  const entry = await readEntry(supabase, entryId)
  if (!entry) return null
  const [answers, stageAnswers, history, tasks] = await Promise.all([
    getEntryAnswers(entryId), getEntryStageAnswers(entryId), getEntryStageHistory(entryId), getEntryTasks(entryId),
  ])
  return {
    ...entry,
    form_answers: answers.map((a) => ({ question: a.node?.question_text ?? null, answer: a.answer_text })),
    stage_answers: stageAnswers,
    stage_history: history.map((h) => ({ from: h.from_stage?.name ?? null, to: h.to_stage?.name ?? null, at: h.moved_at })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, assignee: t.assignee?.name ?? null })),
  }
}

export function registerPipelineTools(server: McpServer) {
  server.registerTool('list_pipelines', {
    title: 'List pipelines',
    description: 'Pipelines with their stages in order (ids, names, type: lead/accepted/rejected/custom) and any questions a stage asks when an entry moves in.',
    annotations: { readOnlyHint: true },
  }, run('list_pipelines', async () => {
    const { supabase } = await requireRole(INTERNAL)
    const { data, error } = await supabase
      .from('pipelines')
      .select('id, name, description, stages:pipeline_stages(id, name, position, stage_type, questions:pipeline_stage_questions(id, label, field_type, required, position))')
      .order('name')
    if (error) throw error
    return ok(((data ?? []) as Array<{ id: string; name: string; description: string | null; stages: Array<{ id: string; name: string; position: number; stage_type: string | null; questions: Array<{ id: string; label: string; field_type: string; required: boolean; position: number }> }> }>).map((p) => ({
      id: p.id, name: p.name, description: p.description,
      stages: [...(p.stages ?? [])].sort((a, b) => a.position - b.position).map((s) => ({
        id: s.id, name: s.name, order: s.position, type: s.stage_type ?? 'custom',
        questions: [...(s.questions ?? [])].sort((a, b) => a.position - b.position).map((q) => ({ question_id: q.id, label: q.label, type: q.field_type, required: q.required })),
      })),
    })))
  }))

  server.registerTool('list_pipeline_entries', {
    title: 'List pipeline entries',
    description: "Entries (startups in a pipeline), newest first. Filter by pipeline, stage, assignee ('me' allowed) or company. Paginated with limit/offset.",
    inputSchema: {
      pipeline_id: uuid.optional(),
      stage_id: uuid.optional(),
      assignee_id: z.union([uuid, z.literal('me')]).optional(),
      company_id: uuid.optional(),
      ...pageArgs,
    },
    annotations: { readOnlyHint: true },
  }, run('list_pipeline_entries', async (args: { pipeline_id?: string; stage_id?: string; assignee_id?: string; company_id?: string; limit: number; offset: number }) => {
    const { supabase, userId } = await requireRole(INTERNAL)
    let q = supabase.from('pipeline_entries').select(ENTRY_SELECT, { count: 'exact' }).order('submitted_at', { ascending: false })
    if (args.pipeline_id) q = q.eq('pipeline_id', args.pipeline_id)
    if (args.stage_id) q = q.eq('stage_id', args.stage_id)
    if (args.company_id) q = q.eq('company_id', args.company_id)
    if (args.assignee_id) {
      const who = args.assignee_id === 'me' ? userId : args.assignee_id
      const { data: rows } = await supabase.from('pipeline_entry_assignees').select('entry_id').eq('user_id', who)
      const ids = (rows ?? []).map((r: { entry_id: string }) => r.entry_id)
      if (ids.length === 0) return ok({ total: 0, entries: [] })
      q = q.in('id', ids.slice(0, 1000))
    }
    const { data, error, count } = await q.range(args.offset, args.offset + args.limit - 1)
    if (error) throw error
    return ok({ total: count ?? null, offset: args.offset, entries: ((data ?? []) as unknown as EntryRow[]).map(shapeEntry) })
  }))

  server.registerTool('get_pipeline_entry', {
    title: 'Get a pipeline entry',
    description: 'One entry with its stage, assignees, form answers, stage answers, stage history, linked tasks and deal (if accepted).',
    inputSchema: { entry_id: uuid },
    annotations: { readOnlyHint: true },
  }, run('get_pipeline_entry', async ({ entry_id }: { entry_id: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    const entry = await readEntryFull(supabase, entry_id)
    return entry ? ok(entry) : refuse('No entry with that id that you can see.')
  }))

  server.registerTool('create_pipeline_entry', {
    title: 'Add a startup to a pipeline',
    description: 'Creates an entry in a pipeline (default: its first stage; not Accepted/Rejected). Link a company by company_id, or give company_name to create one after a duplicate check. Stage automations fire as on the board.',
    inputSchema: {
      pipeline_id: uuid,
      title: shortText(200).min(1).describe('Usually the startup name'),
      stage_id: uuid.optional(),
      company_id: uuid.optional(),
      company_name: shortText(200).min(1).optional().describe('Create a company with this name (after the duplicate check)'),
      force: z.boolean().default(false).describe('Create the company even if similar ones exist'),
      submitter_name: shortText(120).optional().describe('Founder or referrer name'),
      submitter_email: z.string().email().max(254).optional(),
      assignee_ids: z.array(uuid).max(10).optional().describe('Default: me'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_pipeline_entry', async (args: {
    pipeline_id: string; title: string; stage_id?: string; company_id?: string; company_name?: string; force: boolean
    submitter_name?: string; submitter_email?: string; assignee_ids?: string[]
  }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const company = await resolveCompany(args)
    if ('result' in company) return company.result
    const entryId = await createEntry({
      pipeline_id: args.pipeline_id, title: args.title, stage_id: args.stage_id ?? null, company_id: company.companyId,
      submitter_name: args.submitter_name ?? null, submitter_email: args.submitter_email ?? null, assignee_ids: args.assignee_ids,
    })
    return ok({ created: true, entry: await readEntryFull(supabase, entryId) })
  }))

  server.registerTool('move_pipeline_entry', {
    title: 'Move an entry to a stage',
    description: 'Moves an entry to another stage of its pipeline, with the board’s rules: it must have an assignee, Rejected needs reason, stages with questions need answers, Accepted is done on the board. Fires stage automations (e.g. auto-tasks). note is saved to the linked company’s updates.',
    inputSchema: {
      entry_id: uuid,
      stage_id: uuid,
      reason: shortText(1000).optional().describe('Required when moving to Rejected'),
      answers: z.array(z.object({ question_id: uuid, value: z.string().max(5000) })).max(50).optional().describe('For stages with questions (see list_pipelines)'),
      note: shortText(5000).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('move_pipeline_entry', async (args: { entry_id: string; stage_id: string; reason?: string; answers?: Array<{ question_id: string; value: string }>; note?: string }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const before = await readEntry(supabase, args.entry_id)
    if (!before) return refuse('No entry with that id that you can see.')
    const openBefore = new Set((await getEntryTasks(args.entry_id)).filter((t) => t.status !== 'Done').map((t) => t.id))

    await moveEntryChecked(args.entry_id, args.stage_id, {
      reason: args.reason ?? null,
      answers: (args.answers ?? []).map((a) => ({ questionId: a.question_id, value: a.value })),
    })

    let noteSaved: boolean | string = false
    if (args.note) {
      if (before.company) {
        const after = await readEntry(supabase, args.entry_id)
        await addUpdate(before.company.id, `Moved to ${(after?.stage as { name?: string } | null)?.name ?? 'a new stage'}: ${args.note}`)
        noteSaved = true
      } else {
        noteSaved = 'not saved: the entry has no linked company'
      }
    }
    const entry = await readEntryFull(supabase, args.entry_id)
    return ok({
      moved: { from: before.stage, to: entry?.stage ?? null },
      tasks_raised: (entry?.tasks ?? []).filter((t) => t.status !== 'Done' && !openBefore.has(t.id)),
      note_saved: noteSaved,
      entry,
    })
  }))
}
