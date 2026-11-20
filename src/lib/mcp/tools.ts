import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { getUser } from '@/lib/user'
import { userFacingMessage } from '@/lib/action-errors'
import { createTask, updateTaskStatus, getTaskComments, addTaskComment } from '@/app/actions/tasks'

/**
 * The pilot tool set for Claude.
 *
 * Rules every tool follows:
 *  - Permissions come from the same guards and RLS as the web app. A tool never uses a service key
 *    and never checks a role the app doesn't; if the person can't do it in the browser, the call fails.
 *  - Writes go through the existing server actions, so validation, notifications and revalidation
 *    are the app's own. Reads may query directly, but only through the caller's RLS-bound client.
 *  - Errors only carry text we wrote (UserFacingError) — never a raw Postgres message.
 *
 * Deliberately not here yet: deletes, admin, HR/compensation, investors. Add them one at a time.
 */

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
}

function fail(err: unknown): CallToolResult {
  const message = userFacingMessage(err)
    ?? (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')
      ? `${err.message}: your Ecosystem role does not allow this.`
      : 'Something went wrong in Ecosystem. If it keeps happening, tell an admin.')
  if (!userFacingMessage(err)) console.error('[mcp] tool failed:', err)
  return { isError: true, content: [{ type: 'text', text: message }] }
}

/** Wraps a handler so every tool logs who called it and returns errors in one shape. */
function run<A>(name: string, fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      const result = await fn(args)
      console.info(`[mcp] ${name} ok`)
      return result
    } catch (err) {
      return fail(err)
    }
  }
}

const uuid = z.string().uuid()

export function registerTools(server: McpServer) {
  // ─── Who am I ──────────────────────────────────────────────────────────────
  server.registerTool('whoami', {
    title: 'Who am I',
    description: 'The Ecosystem account Claude is acting as: name, email, role and designation.',
    annotations: { readOnlyHint: true },
  }, run('whoami', async () => {
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    return ok({ id: user.id, name: user.name, email: user.email, role: user.role, designation: user.designation })
  }))

  // ─── Tasks ─────────────────────────────────────────────────────────────────
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
    const { data: task, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, pushed_date, push_count, link_url, created_at, completed_at, company:company_id(id, name), assignee:assignee_id(name), assigned_by:assigned_by_id(name)')
      .eq('id', task_id)
      .maybeSingle()
    if (error) throw error
    if (!task) return ok('No task with that id that you can see.')
    const comments = await getTaskComments(task_id)
    return ok({
      ...task,
      comments: comments.map((c) => ({ author: c.author?.name ?? null, body: c.body, at: c.created_at })),
    })
  }))

  server.registerTool('create_task', {
    title: 'Create a task for myself',
    description: 'Adds a task to my own Ecosystem task board.',
    inputSchema: {
      title: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
      priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
      company_id: uuid.optional().describe('Link to a company (from search_companies)'),
      link_url: z.string().url().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_task', async (args: {
    title: string; description?: string; due_date?: string; priority: string; company_id?: string; link_url?: string
  }) => {
    const { userId } = await requireRole(INTERNAL)
    const fd = new FormData()
    fd.set('title', args.title)
    fd.set('assignee_id', userId)
    fd.set('priority', args.priority)
    if (args.description) fd.set('description', args.description)
    if (args.due_date) fd.set('due_date', args.due_date)
    if (args.company_id) fd.set('company_id', args.company_id)
    if (args.link_url) fd.set('link_url', args.link_url)
    const task = await createTask(fd)
    return ok({ created: { id: task.id, title: task.title, due_date: task.due_date, priority: task.priority } })
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
    const { data } = await supabase.from('tasks').select('status').eq('id', task_id).maybeSingle()
    if (!data) return { isError: true, content: [{ type: 'text', text: 'No task with that id that you can see.' }] }
    if (data.status !== status) {
      return { isError: true, content: [{ type: 'text', text: "That task wasn't updated — you can only change tasks you're allowed to edit." }] }
    }
    return ok(`Task is now '${status}'.`)
  }))

  server.registerTool('add_task_comment', {
    title: 'Comment on a task',
    description: 'Posts a comment on a task. The assignee is notified.',
    inputSchema: { task_id: uuid, body: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('add_task_comment', async ({ task_id, body }: { task_id: string; body: string }) => {
    await addTaskComment(task_id, body)
    return ok('Comment posted.')
  }))

  // ─── Companies (read-only) ─────────────────────────────────────────────────
  server.registerTool('search_companies', {
    title: 'Search companies',
    description: 'Finds companies in the Ecosystem database by name. Returns ids for get_company.',
    inputSchema: {
      query: z.string().trim().min(1).max(200),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: { readOnlyHint: true },
  }, run('search_companies', async ({ query, limit }: { query: string; limit: number }) => {
    const { supabase } = await requireRole(INTERNAL)
    // Escape the LIKE wildcards so a search for "100%" means the text, not "100 then anything".
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, one_liner, status, stage, sectors, hq_city')
      .or(`name.ilike.${JSON.stringify(pattern)},legal_name.ilike.${JSON.stringify(pattern)}`)
      .order('name')
      .limit(limit)
    if (error) throw error
    return ok(data ?? [])
  }))

  server.registerTool('get_company', {
    title: 'Get a company profile',
    description: 'The full profile of one company: overview, product, traction, current raise and founders.',
    inputSchema: { company_id: uuid },
    annotations: { readOnlyHint: true },
  }, run('get_company', async ({ company_id }: { company_id: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    const { data, error } = await supabase
      .from('companies')
      .select(`
        id, name, legal_name, website, one_liner, description, hq_city, hq_country, founded_date,
        sectors, stage, business_model, status, tags,
        product_description, usp, tech_stack, product_links,
        arr_inr, mrr_inr, customers_count, team_size, gross_margin_pct, monthly_burn_inr, runway_months,
        ask_inr, instrument, pre_money_inr, post_money_inr, round_status, min_ticket_inr, total_raised_inr, use_of_funds,
        founders, team, esv_poc:users!esv_poc_id(name), updated_at
      `)
      .eq('id', company_id)
      .maybeSingle()
    if (error) throw error
    return ok(data ?? 'No company with that id that you can see.')
  }))
}
