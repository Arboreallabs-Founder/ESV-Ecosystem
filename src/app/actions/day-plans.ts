'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { DayPlanKind } from '@/lib/types'
import { istDate } from '@/lib/ist-date'

/* The daily plan and the end-of-day wrap.
 *
 * Morning: what you intend to do today. Evening: how today went, and what tomorrow looks like.
 * Each is one row per person per day, and the lines someone types become real personal to-dos
 * carrying plan_date — so planning the day is the same act as filling the list, rather than a
 * parallel note that then has to be transcribed.
 *
 * Unlike the rest of personal_todos, a day plan is READ BY FOUNDERS AND ADMINS. That was an
 * explicit product decision (it is a report, so submitting it is sending it) and the UI says so
 * at the point of writing. The RLS lives in 20261002000000.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'general', 'hr'])
}

export type DayPlanInput = {
  kind: DayPlanKind
  /** Defaults to today (morning) or tomorrow (evening) — the day the items are FOR. */
  plan_date?: string
  note?: string | null
  /** One to-do per line. Blank lines are dropped; existing items are not touched. */
  items?: string[]
  /** Monday of the work week to also file the new items into, if any. */
  work_week_start?: string | null
  /** Already-open personal to-dos folded into this plan — only plan_date changes on them. */
  existing_todo_ids?: string[]
  /** Already-open Tasks folded into this plan — ported in as a linked personal_todo first if this
      is the first time (same as "Port in a task"), then dated, in one step. */
  task_ids?: string[]
}

/**
 * Save a day plan and turn its lines into to-dos.
 *
 * Upsert, not insert: reopening the form during the day edits that entry rather than filing a
 * second one. Items are additive — re-saving a plan does not delete to-dos already created from
 * it, because by then they may be half done or edited.
 */
export async function saveDayPlan(input: DayPlanInput): Promise<{ planId: string; created: number }> {
  const { supabase, userId, orgId } = await requireInternal()

  // An evening wrap plans tomorrow; a morning plan is for today. The caller may override, which
  // is what lets someone fill yesterday's wrap in late.
  const planDate = input.plan_date || (input.kind === 'evening' ? istDate(1) : istDate(0))

  const note = input.note?.trim() || null
  const items = (input.items ?? []).map((t) => t.trim()).filter(Boolean)
  const existingTodoIds = [...new Set(input.existing_todo_ids ?? [])]
  const taskIds = [...new Set(input.task_ids ?? [])]
  if (!note && items.length === 0 && existingTodoIds.length === 0 && taskIds.length === 0) {
    throw new UserFacingError('Add at least one line, pick something from your list, or write a note.')
  }

  const { data: plan, error: planErr } = await supabase
    .from('day_plans')
    .upsert(
      { user_id: userId, org_id: orgId, plan_date: planDate, kind: input.kind, note },
      { onConflict: 'user_id,plan_date,kind' },
    )
    .select('id')
    .single()
  if (planErr) throw dbFailure('save that', planErr)

  let created = 0
  if (items.length > 0) {
    const { error: todoErr } = await supabase.from('personal_todos').insert(
      items.map((title) => ({
        user_id: userId,
        org_id: orgId,
        title,
        plan_date: planDate,
        work_week_start: input.work_week_start || null,
      })),
    )
    if (todoErr) throw dbFailure('save that', todoErr)
    created = items.length
  }

  // Already-open to-dos folded into today's/tomorrow's plan — only plan_date moves on them; notes,
  // due dates and work weeks the person already set stay exactly as they were.
  if (existingTodoIds.length > 0) {
    const { error } = await supabase
      .from('personal_todos')
      .update({ plan_date: planDate })
      .eq('user_id', userId)
      .in('id', existingTodoIds)
    if (error) throw dbFailure('save that', error)
  }

  // Tasks folded into the plan — the same "port in, then it's a to-do" portTaskIn already does,
  // batched, with plan_date set in the same step. A task already ported earlier just gets dated.
  if (taskIds.length > 0) {
    const { data: already, error: alreadyErr } = await supabase
      .from('personal_todos')
      .select('id, linked_task_id')
      .eq('user_id', userId)
      .in('linked_task_id', taskIds)
    if (alreadyErr) throw dbFailure('save that', alreadyErr)

    const portedTaskIds = new Set((already ?? []).map((r) => r.linked_task_id as string))
    const alreadyIds = (already ?? []).map((r) => r.id as string)
    if (alreadyIds.length > 0) {
      const { error } = await supabase.from('personal_todos').update({ plan_date: planDate }).in('id', alreadyIds)
      if (error) throw dbFailure('save that', error)
    }

    const toPort = taskIds.filter((id) => !portedTaskIds.has(id))
    if (toPort.length > 0) {
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select('id, title, status, due_date')
        .in('id', toPort)
      if (tasksErr) throw dbFailure('save that', tasksErr)
      if (tasksData && tasksData.length > 0) {
        const { error } = await supabase.from('personal_todos').insert(
          tasksData.map((t) => ({
            user_id: userId,
            org_id: orgId,
            title: t.title,
            linked_task_id: t.id,
            done: t.status === 'Done',
            done_at: t.status === 'Done' ? new Date().toISOString() : null,
            due_date: t.due_date,
            plan_date: planDate,
          })),
        )
        if (error) throw dbFailure('save that', error)
      }
    }
  }

  revalidatePath('/my-todos')
  revalidatePath('/tasks/update')
  return { planId: plan.id as string, created }
}

export async function deleteDayPlan(id: string): Promise<void> {
  const { supabase, userId } = await requireInternal()
  // Scoped to the caller: a founder can read everyone's plans, but deleting someone's report is
  // not a thing leadership should be able to do by knowing an id.
  const { error } = await supabase.from('day_plans').delete().eq('id', id).eq('user_id', userId)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/my-todos')
  revalidatePath('/tasks/update')
}
