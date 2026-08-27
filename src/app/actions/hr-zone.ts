'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

// HR can create/edit HR policies too (not delete) — see the audit log this writes to.
// General lost this tier when HR was introduced.
async function requireEditor() {
  return requireRole(['founder', 'admin', 'hr'])
}

export type HrPolicyInput = {
  title: string
  category?: string | null
  body: string
}

function describeHrChanges(
  before: { title: string; category: string | null; body: string },
  after: { title: string; category: string | null; body: string },
): string {
  const lines: string[] = []
  if (before.title !== after.title) lines.push(`Title: ${before.title} → ${after.title}`)
  if ((before.category ?? '') !== (after.category ?? '')) lines.push(`Category: ${before.category ?? '—'} → ${after.category ?? '—'}`)
  if (before.body !== after.body) lines.push('Policy text updated')
  return lines.join('; ')
}

export async function createHrPolicy(input: HrPolicyInput): Promise<string> {
  const { supabase, userId, orgId } = await requireEditor()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) throw new UserFacingError('Title is required.')
  if (!body) throw new UserFacingError('Policy body is required.')

  const { count } = await supabase.from('hr_policies').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
  const { data, error } = await supabase
    .from('hr_policies')
    .insert({ org_id: orgId, created_by: userId, title, category: input.category?.trim() || null, body, position: count ?? 0 })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)

  try {
    const { data: editor } = await supabase.from('users').select('name').eq('id', userId).single()
    await supabase.from('hr_policy_edit_log').insert({
      policy_id: data.id, org_id: orgId, edited_by: userId, edited_by_name: editor?.name ?? null,
      policy_title: title, action: 'created', changes: 'Created',
    })
  } catch { /* non-fatal: don't block the save if the audit log insert fails */ }

  revalidatePath('/hr')
  return data.id as string
}

export async function updateHrPolicy(id: string, input: HrPolicyInput): Promise<void> {
  const { supabase, userId, orgId } = await requireEditor()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) throw new UserFacingError('Title is required.')
  if (!body) throw new UserFacingError('Policy body is required.')
  const category = input.category?.trim() || null

  const { data: before } = await supabase.from('hr_policies').select('title, category, body').eq('id', id).single()

  const { error } = await supabase
    .from('hr_policies')
    .update({ title, category, body })
    .eq('id', id)
  if (error) throw dbFailure('save that', error)

  try {
    const changes = before ? describeHrChanges(before, { title, category, body }) : ''
    if (changes) {
      const { data: editor } = await supabase.from('users').select('name').eq('id', userId).single()
      await supabase.from('hr_policy_edit_log').insert({
        policy_id: id, org_id: orgId, edited_by: userId, edited_by_name: editor?.name ?? null,
        policy_title: title, action: 'updated', changes,
      })
    }
  } catch { /* non-fatal: don't block the save if the audit log insert fails */ }

  revalidatePath('/hr')
}

export async function deleteHrPolicy(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('hr_policies').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/hr')
}
