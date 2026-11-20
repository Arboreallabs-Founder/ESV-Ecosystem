import { createClient } from '@/lib/supabase/server'
import type { ActivityLogEntry } from '@/lib/types'

/**
 * Reads activity_events (20261121000200) — the trigger-written log of every create/update/delete on
 * companies, custom fields, tasks, pipeline entries and deals — for Admin → Activity Log.
 *
 * Tolerates the table not existing yet (code deployed before the migration): returns nothing rather
 * than failing the page.
 */

type Row = {
  id: string
  actor_id: string | null
  source: 'web' | 'connector' | 'system'
  client: string | null
  entity_type: ActivityLogEntry['entity_type']
  entity_label: string | null
  action: ActivityLogEntry['action']
  changes: Record<string, unknown>
  created_at: string
}

// Noise in a human-readable line: ids and bookkeeping the person didn't type.
const HIDDEN_KEYS = new Set(['id', 'org_id', 'created_by', 'created_at', 'updated_at', 'author_id', 'meta_tags'])

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 77)}…` : v
  if (Array.isArray(v)) return v.length > 3 ? `[${v.length} items]` : JSON.stringify(v)
  if (typeof v === 'object') return '{…}'
  return String(v)
}

/** "stage_id: A → B; title: x → y" for updates; the notable fields for creates and deletes. */
export function summarizeChanges(action: ActivityLogEntry['action'], changes: Record<string, unknown>): string {
  const keys = Object.keys(changes).filter((k) => !HIDDEN_KEYS.has(k))
  if (action === 'updated') {
    return keys.map((k) => {
      const c = changes[k] as { before?: unknown; after?: unknown } | unknown
      if (c && typeof c === 'object' && 'after' in (c as object)) {
        const { before, after } = c as { before?: unknown; after?: unknown }
        return `${k}: ${show(before)} → ${show(after)}`
      }
      return `${k}: ${show(c)}`
    }).join('; ') || 'updated'
  }
  const shown = keys.slice(0, 6).map((k) => `${k}: ${show(changes[k])}`)
  return `${action === 'created' ? 'created' : 'deleted'}${shown.length ? ` (${shown.join('; ')}${keys.length > 6 ? '; …' : ''})` : ''}`
}

export async function fetchActivityEvents(limit = 500): Promise<ActivityLogEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('activity_events')
    .select('id, actor_id, source, client, entity_type, entity_label, action, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  const rows = data as Row[]

  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x)))
  const names = new Map<string, string>()
  if (actorIds.length) {
    const { data: users } = await supabase.from('users').select('id, name, email').in('id', actorIds)
    for (const u of (users ?? []) as Array<{ id: string; name: string | null; email: string }>) names.set(u.id, u.name || u.email)
  }

  return rows.map((r) => ({
    id: `activity-${r.id}`,
    entity_type: r.entity_type,
    entity_name: r.entity_label ?? '(untitled)',
    edited_by_name: r.actor_id ? names.get(r.actor_id) ?? null : r.source === 'system' ? 'System' : null,
    action: r.action,
    changes: summarizeChanges(r.action, r.changes ?? {}),
    created_at: r.created_at,
    source: r.source,
    client: r.client,
  }))
}
