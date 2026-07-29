import type { TaskPush, PushStats } from './types'

/* Push-reason aggregates for /tasks/kpi.
   Deliberately separate from task-kpi.ts: that file is pure per-task maths over the `tasks` rows,
   whereas this rolls up the `task_pushes` log — the *history* of why dates moved, which `tasks`
   can't answer (it only ever carries the latest push).

   Pure functions only, no data access: TaskKpiView is a client component, so anything it imports
   is bundled for the browser. The fetch lives in src/lib/tasks.ts with the other server reads. */

/** How many recent pushes each person's row keeps for the expanded reason list. */
const RECENT_LIMIT = 8

/** Roll a push log up per person: how often they pushed, and what was blocking them. */
export function computePushStats(userId: string, pushes: TaskPush[]): PushStats {
  const stats: PushStats = { user_id: userId, total: 0, blockedExternal: 0, blockedBy: {}, recent: [] }

  for (const p of pushes) {
    if (p.pushed_by !== userId) continue
    stats.total++
    if (p.blocked_external) stats.blockedExternal++
    if (p.blocked_by_user_id) {
      stats.blockedBy[p.blocked_by_user_id] = (stats.blockedBy[p.blocked_by_user_id] ?? 0) + 1
    }
    if (stats.recent.length < RECENT_LIMIT) stats.recent.push(p)
  }

  return stats
}

/**
 * Blocker tally as display-ready names, heaviest first.
 * Names come off the joined rows so callers don't need the whole user list.
 */
export function blockerBreakdown(stats: PushStats, pushes: TaskPush[]): Array<{ name: string; count: number }> {
  return Object.entries(stats.blockedBy)
    .map(([id, count]) => ({
      name: pushes.find((p) => p.blocked_by_user_id === id)?.blocked_by_user?.name ?? 'Someone',
      count,
    }))
    .sort((a, b) => b.count - a.count)
}
