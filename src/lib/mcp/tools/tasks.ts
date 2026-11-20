import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { getUser } from '@/lib/user'
import { createTask, updateTask, updateTaskStatus, getTaskComments, addTaskComment } from '@/app/actions/tasks'
import { INTERNAL, ok, refuse, run, uuid, isoDate, diff } from './shared'

const TASK_FIELDS = 'id, title, description, status, priority, due_date, pushed_date, push_count, link_url, created_at, completed_at, assignee_id, desk_deal_id, company:company_id(id, name), assignee:assignee_id(name), assigned_by:assigned_by_id(name)'
const EDITABLE = ['title', 'description', 'due_date', 'priority', 'link_url', 'company_id'] as const

type TaskRow = Record<string, unknown> & { id: string; assignee_id: string | null; desk_deal_id: string | null; company?: { id: string } | null }

export function registerTaskTools(server: McpServer) {
  server.registerTool('whoami', {
    title: 'Who am I',
    description: 'The Ecosystem account the assistant is acting as: name, email, role and designation.',
    annotations: { readOnlyHint: true },
  }, run('whoami', async () => {
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    return ok({ id: user.id, name: user.name, email: user.email, role: user.role, designation: user.designation })
  }))

  server.registerTool('list_my_tasks', {
    title: 'List my tasks',
    description: 'Tasks assigned to me in Ecosystem, open ones first by due date. Use the returned id with the other task tools.',
    inputSchema: {
      status: z.enum(['To Do', 'Done', 'all']).default('To Do').describe("'To Do' (default), 'Done', or 'all'"),
      limit: z.number().int().min(1).max(100).default(50),
    },
    annotations: { readOnlyHint: true },
  }, run('list_my_tasks', async ({ status, limit }: { status: 'To Do' | 'Done' | 'all'; limit: number }) => {
    const { supabase, userId } = await requireRole(INTERNAL)
    let q = supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, pushed_date, link_url, created_at, completed_at, company:company_id(id, name), assigned_by:assigned_by_id(name)')
      .eq('assignee_id', userId)
      .order('status', { ascending: false }) // 'To Do' sorts after 'Done' alphabetically; descending puts open first
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(limit)
    if (status !== 'all') q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw error
    return ok(data ?? [])
  }))

  server.registerTool('get_task', {
    title: 'Get a task',
    description: 'One task with its full details and comment thread.',
    inputSchema: { task_id: uuid },
    annotations: { readOnlyHint: true },
  }, run('get_task', async ({ task_id }: { task_id: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    const { data: task, error } = await supabase.from('tasks').select(TASK_FIELDS).eq('id', task_id).maybeSingle()
    if (error) throw error
    if (!task) return refuse('No task with that id that you can see.')
    const comments = await getTaskComments(task_id)
    return ok({ ...task, comments: comments.map((c) => ({ author: c.author?.name ?? null, body: c.body, at: c.created_at })) })
  }))

  server.registerTool('create_task', {
    title: 'Create a task for myself',
    description: "Adds a task to my own task board. To log work already done, set status 'Done'; add completed_at to backdate it (no future dates).",
    inputSchema: {
      title: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional(),
      due_date: isoDate.optional().describe('YYYY-MM-DD'),
      priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
      company_id: uuid.optional().describe('Link to a company (from search_companies)'),
      link_url: z.string().url().max(2000).optional(),
      status: z.enum(['To Do', 'Done']).default('To Do'),
      completed_at: z.string().max(40).optional().describe("YYYY-MM-DD or ISO timestamp; only with status 'Done'"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_task', async (args: {
    title: string; description?: string; due_date?: string; priority: string; company_id?: string; link_url?: string
    status: 'To Do' | 'Done'; completed_at?: string
  }) => {
    const { supabase, userId } = await requireRole(INTERNAL)
    const fd = new FormData()
    fd.set('title', args.title)
    fd.set('assignee_id', userId)
    fd.set('priority', args.priority)
    // completed_at alone means Done; resolveTaskCompletion (in createTask) enforces the rest.
    fd.set('status', args.completed_at ? 'Done' : args.status)
    if (args.completed_at) fd.set('completed_at', args.completed_at)
    if (args.description) fd.set('description', args.description)
    if (args.due_date) fd.set('due_date', args.due_date)
    if (args.company_id) fd.set('company_id', args.company_id)
    if (args.link_url) fd.set('link_url', args.link_url)
    const task = await createTask(fd)
    const { data } = await supabase.from('tasks').select(TASK_FIELDS).eq('id', task.id).maybeSingle()
    return ok({ created: data ?? task })
  }))

  server.registerTool('update_task', {
    title: 'Update a task',
    description: 'Changes only the fields passed: title, description, due_date, priority, link_url, company_id (null clears). Returns before and after.',
    inputSchema: {
      task_id: uuid,
      title: z.string().trim().min(1).max(300).optional(),
      description: z.string().max(5000).nullable().optional(),
      due_date: isoDate.nullable().optional(),
      priority: z.enum(['Low', 'Medium', 'High']).optional(),
      link_url: z.string().url().max(2000).nullable().optional(),
      company_id: uuid.nullable().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('update_task', async (args: { task_id: string } & Partial<Record<typeof EDITABLE[number], string | null>>) => {
    const { supabase } = await requireRole(INTERNAL)
    const { data: before } = await supabase.from('tasks').select(TASK_FIELDS + ', company_id').eq('id', args.task_id).maybeSingle()
    if (!before) return refuse('No task with that id that you can see.')
    const b = before as unknown as TaskRow
    const passed = EDITABLE.filter((k) => args[k] !== undefined)
    if (passed.length === 0) return refuse('Pass at least one field to change.')

    // updateTask replaces every field, so start from the current values and overlay what was passed.
    const next: Record<string, string | null> = {}
    for (const k of EDITABLE) next[k] = (args[k] !== undefined ? args[k] : (b[k] as string | null)) ?? null
    const fd = new FormData()
    fd.set('title', next.title ?? '')
    fd.set('description', next.description ?? '')
    fd.set('due_date', next.due_date ?? '')
    fd.set('priority', next.priority ?? 'Medium')
    fd.set('link_url', next.link_url ?? '')
    fd.set('company_id', next.company_id ?? '')
    fd.set('assignee_id', b.assignee_id ?? '')
    fd.set('desk_deal_id', b.desk_deal_id ?? '')
    await updateTask(args.task_id, fd)

    const { data: after } = await supabase.from('tasks').select(TASK_FIELDS + ', company_id').eq('id', args.task_id).maybeSingle()
    return ok({ changed: diff(b, (after ?? {}) as Record<string, unknown>, [...passed]), task: after })
  }))

  server.registerTool('update_task_status', {
    title: 'Mark a task done or reopen it',
    description: "Sets a task's status to 'Done' or back to 'To Do'.",
    inputSchema: { task_id: uuid, status: z.enum(['To Do', 'Done']) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('update_task_status', async ({ task_id, status }: { task_id: string; status: 'To Do' | 'Done' }) => {
    const { supabase } = await requireRole(INTERNAL)
    await updateTaskStatus(task_id, status)
    // The action doesn't report an RLS-filtered no-op, so confirm the change actually landed
    // rather than telling the person it did.
    const { data } = await supabase.from('tasks').select(TASK_FIELDS).eq('id', task_id).maybeSingle()
    if (!data) return refuse('No task with that id that you can see.')
    if ((data as { status: string }).status !== status) {
      return refuse("That task wasn't updated — you can only change tasks you're allowed to edit.")
    }
    return ok({ task: data })
  }))

  server.registerTool('add_task_comment', {
    title: 'Comment on a task',
    description: 'Posts a comment on a task. The assignee is notified.',
    inputSchema: { task_id: uuid, body: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('add_task_comment', async ({ task_id, body }: { task_id: string; body: string }) => {
    await addTaskComment(task_id, body)
    const comments = await getTaskComments(task_id)
    return ok({ comments: comments.map((c) => ({ author: c.author?.name ?? null, body: c.body, at: c.created_at })) })
  }))
}
