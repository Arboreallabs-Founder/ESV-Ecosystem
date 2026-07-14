'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'

async function requireAdmin() {
  return requireRole(['founder', 'admin'])
}

export type HrPolicyInput = {
  title: string
  category?: string | null
  body: string
}

export async function createHrPolicy(input: HrPolicyInput): Promise<string> {
  const { supabase, userId, orgId } = await requireAdmin()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) throw new Error('Title is required.')
  if (!body) throw new Error('Policy body is required.')

  const { count } = await supabase.from('hr_policies').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
  const { data, error } = await supabase
    .from('hr_policies')
    .insert({ org_id: orgId, created_by: userId, title, category: input.category?.trim() || null, body, position: count ?? 0 })
    .select('id')
    .single()
  if (error) throw error
  revalidatePath('/hr')
  return data.id as string
}

export async function updateHrPolicy(id: string, input: HrPolicyInput): Promise<void> {
  const { supabase } = await requireAdmin()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) throw new Error('Title is required.')
  if (!body) throw new Error('Policy body is required.')

  const { error } = await supabase
    .from('hr_policies')
    .update({ title, category: input.category?.trim() || null, body })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/hr')
}

export async function deleteHrPolicy(id: string): Promise<void> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('hr_policies').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/hr')
}
