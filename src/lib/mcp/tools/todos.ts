import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { INTERNAL, isoDate, ok, refuse, run, one } from './shared'

/**
 * Personal to-do lists (/my-todos). Founders and admins can read everyone's (20261201000000); anyone
 * else, their own. RLS enforces it; the checks here only turn "nothing came back" into a sentence.
 * Read-only: an item is changed by its owner, in the app.
 */

type Person = { id: string; name: string | null; email: string; role: string }
type Row = {
  id: string; user_id: string; parent_id: string | null; title: string; notes: string | null
  done: boolean; done_at: string | null; due_date: string | null; plan_date: string | null
  work_week_start: string | null; created_at: string
  linked_task: { title: string; status: string } | Array<{ title: string; status: string }> | null
}

const TEAM_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']
const CAP_ONE = 150
const CAP_TEAM = 40

export function registerTodoTools(server: McpServer) {
  server.registerTool('team_todos', {
    title: 'Personal to-do lists',
    description: "Items on someone's Personal To-Do List: open items (with sub-items nested), and optionally items ticked off since a date. 'shared' means the owner filed it into a work week or day plan. Founders/admins can read anyone's list; others only their own. Read-only.",
    inputSchema: {
      person: z.string().trim().min(1).max(100).describe("'me', 'team', a user id, or a name (from list_people)"),
      done_since: isoDate.optional().describe('YYYY-MM-DD. Also include items ticked off on or after this day'),
    },
    annotations: { readOnlyHint: true },
  }, run('team_todos', async ({ person, done_since }: { person: string; done_since?: string }) => {
    const { supabase, userId, role } = await requireRole(INTERNAL)
    const lead = role === 'founder' || role === 'admin'

    const { data: peopleData, error: peopleErr } = await supabase
      .from('users').select('id, name, email, role').in('role', TEAM_ROLES).order('name')
    if (peopleErr) throw peopleErr
    const people = (peopleData ?? []) as Person[]

    const q = person.trim()
    let targets: Person[]
    if (q.toLowerCase() === 'me') targets = people.filter((p) => p.id === userId)
    else if (q.toLowerCase() === 'team') targets = lead ? people : people.filter((p) => p.id === userId)
    else {
      const byId = people.find((p) => p.id === q)
      targets = byId ? [byId] : people.filter((p) =>
        (p.name ?? '').toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().startsWith(q.toLowerCase()))
      if (targets.length === 0) return refuse(`No one in Ecosystem matches "${q}". Use list_people to find them.`)
      if (!lead && targets.some((p) => p.id !== userId)) return refuse('Only founders and admins can read other people’s to-do lists.')
      if (targets.length > 1 && !byId) {
        return refuse(`"${q}" matches more than one person: ${targets.map((p) => `${p.name ?? p.email} (${p.id})`).join('; ')}. Ask which one, then pass their id.`)
      }
    }
    const ids = targets.map((p) => p.id)

    let query = supabase.from('personal_todos')
      .select('id, user_id, parent_id, title, notes, done, done_at, due_date, plan_date, work_week_start, created_at, linked_task:linked_task_id(title, status)')
      .in('user_id', ids)
    query = done_since
      ? query.or(`done.eq.false,done_at.gte.${done_since}T00:00:00+05:30`)
      : query.eq('done', false)
    const { data, error } = await query.order('created_at', { ascending: true }).limit(5000)
    if (error) throw error
    const rows = (data ?? []) as unknown as Row[]

    // A ticked-off parent's open sub-items still belong under it, so parents come along whatever
    // their state; an open sub-item of a parent not returned is listed on its own.
    const byId = new Map(rows.map((r) => [r.id, r]))
    const shape = (r: Row) => {
      const task = one(r.linked_task)
      return {
        id: r.id, title: r.title, notes: r.notes, done: r.done, done_at: r.done_at,
        due_date: r.due_date, plan_date: r.plan_date, work_week_start: r.work_week_start,
        shared: !!(r.work_week_start || r.plan_date),
        linked_task: task ? { title: task.title, status: task.status } : null,
        sub_items: rows.filter((c) => c.parent_id === r.id).map((c) => ({ id: c.id, title: c.title, done: c.done, done_at: c.done_at })),
      }
    }
    const cap = targets.length > 1 ? CAP_TEAM : CAP_ONE

    return ok({
      ...(done_since ? { done_since } : {}),
      people: targets.map((p) => {
        const top = rows.filter((r) => r.user_id === p.id && (!r.parent_id || !byId.has(r.parent_id)))
        return {
          person: { id: p.id, name: p.name, role: p.role },
          open: top.filter((r) => !r.done).length,
          items: top.slice(0, cap).map(shape),
          ...(top.length > cap ? { more: top.length - cap } : {}),
        }
      }),
      ...(targets.length > 1 ? { note: `Capped at ${cap} items per person; ask about one person for the full list.` } : {}),
    })
  }))
}
