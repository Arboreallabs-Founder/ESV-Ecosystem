import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { isGeneralLead } from '@/lib/user'
import { istRange, DateRangeError } from '@/lib/date-range'
import { todayInIndia } from '@/lib/task-completion'
import { INTERNAL, ok, refuse, run, one } from './shared'

/**
 * People and "what has X done / what's open" — for founders and leads asking about their team.
 *
 * Who can see whom follows the app exactly (and RLS enforces it again underneath):
 *   founder / admin  everyone in the org (tasks + the activity log)
 *   General Lead     themselves and every general user (tasks; the activity log is founder/admin)
 *   everyone else    themselves only
 */

type Supa = Awaited<ReturnType<typeof requireRole>>['supabase']
type Person = { id: string; name: string | null; email: string; role: string; designation: string | null }

const TEAM_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']
const ITEM_CAP_ONE = 50
const ITEM_CAP_TEAM = 10

async function allPeople(supabase: Supa): Promise<Person[]> {
  const { data, error } = await supabase
    .from('users').select('id, name, email, role, designation').in('role', TEAM_ROLES).order('name')
  if (error) throw error
  return (data ?? []) as Person[]
}

/** The people the caller may look at, and a sentence saying so (for refusals). */
async function visibleTo(supabase: Supa, me: { userId: string; role: string }, people: Person[]) {
  if (me.role === 'founder' || me.role === 'admin') return { ids: new Set(people.map((p) => p.id)), scope: 'everyone' }
  if (me.role === 'general' && await isGeneralLead(me.userId)) {
    return { ids: new Set(people.filter((p) => p.role === 'general' || p.id === me.userId).map((p) => p.id)), scope: 'yourself and the general team (you are a General Lead)' }
  }
  return { ids: new Set([me.userId]), scope: 'only yourself' }
}

/** 'me' | 'team' | a user id | a name or email fragment → the people meant, or a refusal message. */
function resolvePeople(input: string, me: string, people: Person[], visible: Set<string>, scope: string): Person[] | string {
  const q = input.trim()
  if (q.toLowerCase() === 'me') return people.filter((p) => p.id === me)
  if (q.toLowerCase() === 'team') return people.filter((p) => visible.has(p.id))
  const byId = people.find((p) => p.id === q)
  const matches = byId ? [byId] : people.filter((p) =>
    (p.name ?? '').toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().startsWith(q.toLowerCase()))
  if (matches.length === 0) return `No one in Ecosystem matches "${q}". Use list_people to find them.`
  const allowed = matches.filter((p) => visible.has(p.id))
  if (allowed.length === 0) return `You can see the work of ${scope}, not ${matches.map((p) => p.name ?? p.email).join(', ')}.`
  if (allowed.length > 1 && !byId) {
    return `"${q}" matches more than one person: ${allowed.map((p) => `${p.name ?? p.email} (${p.id})`).join('; ')}. Ask which one, then pass their id.`
  }
  return allowed
}

export function registerTeamTools(server: McpServer) {
  server.registerTool('list_people', {
    title: 'List people',
    description: 'Ecosystem team members (id, name, email, role, designation), optionally filtered by name. Use the id to assign tasks or ask about someone’s work.',
    inputSchema: { query: z.string().trim().max(100).optional().describe('Part of a name or email') },
    annotations: { readOnlyHint: true },
  }, run('list_people', async ({ query }: { query?: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    let people = await allPeople(supabase)
    if (query) {
      const q = query.toLowerCase()
      people = people.filter((p) => (p.name ?? '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    }
    return ok(people)
  }))

  server.registerTool('team_activity', {
    title: 'What someone has done, and what they have open',
    description: "For one person, 'team', or 'me': tasks completed in a date range (default: this week, India time), open and overdue tasks, and (founders/admins) pipeline stage moves and what they created or changed. Founders/admins can ask about anyone; a General Lead about general users; others only about themselves.",
    inputSchema: {
      person: z.string().trim().min(1).max(100).describe("'me', 'team', a user id, or a name (from list_people)"),
      from: z.string().optional().describe('YYYY-MM-DD, inclusive. Default: Monday of this week'),
      to: z.string().optional().describe('YYYY-MM-DD, inclusive. Default: today'),
    },
    annotations: { readOnlyHint: true },
  }, run('team_activity', async ({ person, from, to }: { person: string; from?: string; to?: string }) => {
    const { supabase, userId, role } = await requireRole(INTERNAL)
    let range
    try { range = istRange(from, to) } catch (e) { if (e instanceof DateRangeError) return refuse(e.message); throw e }

    const people = await allPeople(supabase)
    const { ids: visible, scope } = await visibleTo(supabase, { userId, role }, people)
    const resolved = resolvePeople(person, userId, people, visible, scope)
    if (typeof resolved === 'string') return refuse(resolved)
    const targets = resolved
    const ids = targets.map((p) => p.id)
    const cap = targets.length > 1 ? ITEM_CAP_TEAM : ITEM_CAP_ONE
    const today = todayInIndia()

    const [completedRes, openRes, assignedRes, eventsRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, assignee_id, completed_at, priority, source, company:company_id(name)')
        .in('assignee_id', ids).eq('status', 'Done')
        .gte('completed_at', range.startIso).lt('completed_at', range.endIso)
        .order('completed_at', { ascending: false }).limit(1000),
      supabase.from('tasks')
        .select('id, title, assignee_id, due_date, pushed_date, priority, source, created_at, company:company_id(name), assigned_by:assigned_by_id(name)')
        .in('assignee_id', ids).eq('status', 'To Do')
        .order('due_date', { ascending: true, nullsFirst: false }).limit(1000),
      supabase.from('tasks')
        .select('id, created_by, assignee_id')
        .in('created_by', ids).gte('created_at', range.startIso).lt('created_at', range.endIso).limit(1000),
      // Founder/admin only by RLS; returns nothing for anyone else, which is right.
      supabase.from('activity_events')
        .select('actor_id, entity_type, entity_id, entity_label, action, changes, created_at')
        .in('actor_id', ids).gte('created_at', range.startIso).lt('created_at', range.endIso)
        .order('created_at', { ascending: false }).limit(2000),
    ])
    for (const r of [completedRes, openRes, assignedRes]) if (r.error) throw r.error
    const events = (eventsRes.data ?? []) as Array<{ actor_id: string; entity_type: string; entity_id: string; entity_label: string | null; action: string; changes: Record<string, { before?: unknown; after?: unknown }>; created_at: string }>

    // Stage names for the moves.
    const stageIds = new Set<string>()
    for (const e of events) {
      if (e.entity_type === 'pipeline_entry' && e.action === 'updated' && e.changes?.stage_id) {
        for (const v of [e.changes.stage_id.before, e.changes.stage_id.after]) if (typeof v === 'string') stageIds.add(v)
      }
    }
    const stageNames = new Map<string, string>()
    if (stageIds.size) {
      const { data } = await supabase.from('pipeline_stages').select('id, name').in('id', Array.from(stageIds))
      for (const s of (data ?? []) as Array<{ id: string; name: string }>) stageNames.set(s.id, s.name)
    }

    type T = Record<string, unknown> & { id: string; title: string; assignee_id: string }
    const completed = (completedRes.data ?? []) as unknown as T[]
    const open = (openRes.data ?? []) as unknown as T[]
    const assigned = (assignedRes.data ?? []) as Array<{ created_by: string; assignee_id: string | null }>

    const report = targets.map((p) => {
      const done = completed.filter((t) => t.assignee_id === p.id)
      const mine = open.filter((t) => t.assignee_id === p.id).map((t) => {
        const due = (t.pushed_date as string | null) ?? (t.due_date as string | null)
        return {
          id: t.id, title: t.title, due, overdue: !!due && due < today, priority: t.priority,
          company: one(t.company as { name: string } | null)?.name ?? null,
          assigned_by: one(t.assigned_by as { name: string } | null)?.name ?? null,
          automatic: t.source === 'pipeline' || t.source === 'automatic',
        }
      }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || String(a.due ?? '9999').localeCompare(String(b.due ?? '9999')))
      const theirEvents = events.filter((e) => e.actor_id === p.id)
      const moves = theirEvents
        .filter((e) => e.entity_type === 'pipeline_entry' && e.action === 'updated' && e.changes?.stage_id)
        .map((e) => ({
          entry: e.entity_label, entry_id: e.entity_id, at: e.created_at,
          from: stageNames.get(String(e.changes.stage_id.before)) ?? null,
          to: stageNames.get(String(e.changes.stage_id.after)) ?? null,
        }))
      const count = (type: string, action: string) => theirEvents.filter((e) => e.entity_type === type && e.action === action).length
      return {
        person: { id: p.id, name: p.name, role: p.role, designation: p.designation },
        completed: {
          count: done.length,
          items: done.slice(0, cap).map((t) => ({
            id: t.id, title: t.title, completed_at: t.completed_at,
            company: one(t.company as { name: string } | null)?.name ?? null,
            automatic: t.source === 'pipeline' || t.source === 'automatic',
          })),
        },
        open: { count: mine.length, overdue: mine.filter((t) => t.overdue).length, items: mine.slice(0, cap) },
        assigned_to_others: assigned.filter((a) => a.created_by === p.id && a.assignee_id && a.assignee_id !== p.id).length,
        // The rest come from the activity log, which only founders/admins can read.
        pipeline_moves: moves.slice(0, cap),
        created: {
          companies: count('company', 'created'),
          pipeline_entries: count('pipeline_entry', 'created'),
          deals: count('deal', 'created'),
          comments: count('task_comment', 'created'),
          company_updates: count('company_update', 'created'),
        },
        edited: {
          companies: new Set(theirEvents.filter((e) => e.entity_type === 'company' && e.action === 'updated').map((e) => e.entity_label)).size,
          deals: new Set(theirEvents.filter((e) => e.entity_type === 'deal' && e.action === 'updated').map((e) => e.entity_id)).size,
        },
      }
    })

    return ok({
      range: { from: range.from, to: range.to, timezone: 'Asia/Kolkata' },
      activity_log_included: role === 'founder' || role === 'admin',
      people: report,
      ...(targets.length > 1 ? { note: `Lists capped at ${cap} items per person; ask about one person for the full list.` } : {}),
    })
  }))
}
