import type { PersonalTodo } from './types'

/* Turning the flat personal_todos rows into the two-level shape the UI renders.
 *
 * Pure and synchronous — the query stays flat (one round trip, RLS applied once) and the nesting
 * happens here, so the same helper serves the to-do page and the Weekly Update without either
 * needing a recursive query. Depth is capped at one level in the database, so this is a grouping,
 * not a tree walk. */

/** Top-level items in query order, each with its children attached in query order. */
export function nestTodos(rows: PersonalTodo[]): PersonalTodo[] {
  const childrenOf = new Map<string, PersonalTodo[]>()
  for (const row of rows) {
    if (!row.parent_id) continue
    const list = childrenOf.get(row.parent_id)
    if (list) list.push(row)
    else childrenOf.set(row.parent_id, [row])
  }
  // An orphan — a sub-task whose parent this reader cannot see, which RLS makes possible for a
  // lead reading someone else's list — is promoted rather than dropped. Losing a row silently is
  // worse than showing it a level too high.
  const visible = new Set(rows.map((r) => r.id))
  return rows
    .filter((r) => !r.parent_id || !visible.has(r.parent_id))
    .map((r) => ({ ...r, children: childrenOf.get(r.id) ?? [] }))
}

/**
 * The display names of everyone @mentioned on a to-do, off the real mention rows rather than
 * re-parsing "@Name" back out of the title text — the title is free text a person can edit around a
 * mention, so matching against who was actually tagged is the only way to highlight the right span
 * (and the only one) instead of guessing at capitalised words that happen to follow an "@".
 */
export function mentionedNames(todo: PersonalTodo): string[] {
  return (todo.mentions ?? [])
    .map((m) => m.mentioned_user)
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => u.name || u.email)
}

/**
 * When a sub-task happened, for the list and the weekly rollup.
 *
 * Completed items read as the moment they were ticked; open ones as when they were added. Both
 * are already stored (done_at, created_at) — this is the chosen wording, not new data.
 */
export function todoStamp(todo: PersonalTodo): string | null {
  const iso = todo.done ? todo.done_at : todo.created_at
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return time
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${time}`
}
