'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import type { EscalationLinkedType } from '@/lib/types'

type Option = { id: string; label: string }

// Resolve a snapshot title for a linked entity (stored on the escalation for display).
async function resolveLinkedTitle(
  supabase: Awaited<ReturnType<typeof requireRole>>['supabase'],
  type: EscalationLinkedType,
  id: string,
): Promise<string | null> {
  if (type === 'task') {
    const { data } = await supabase.from('tasks').select('title').eq('id', id).single()
    return data?.title ?? null
  }
  if (type === 'investor') {
    const { data } = await supabase.from('investors').select('name').eq('id', id).single()
    return data?.name ?? null
  }
  if (type === 'pipeline_entry') {
    const { data } = await supabase.from('pipeline_entries').select('title').eq('id', id).single()
    return data?.title ?? null
  }
  // active_deal → title comes from the linked pipeline entry
  const { data } = await supabase
    .from('active_deals')
    .select('entry:pipeline_entries(title)')
    .eq('id', id)
    .single()
  const entry = Array.isArray((data as any)?.entry) ? (data as any).entry[0] : (data as any)?.entry
  return entry?.title ?? null
}

export async function createEscalation(params: {
  subject: string
  body: string | null
  recipientUserId: string
  linkedType: EscalationLinkedType | null
  linkedId: string | null
}) {
  const { supabase, userId, orgId } = await requireRole(['associate', 'admin'])

  const subject = params.subject.trim()
  if (!subject) throw new UserFacingError('Subject is required.')

  // Recipient must be a founder or a partner in the same org.
  const { data: recipient } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', params.recipientUserId)
    .single()
  if (!recipient) throw new UserFacingError('Recipient not found.')
  if (recipient.org_id !== orgId) throw new UserFacingError('Recipient is outside your organization.')
  if (!['founder', 'franchise_partner'].includes(recipient.role)) {
    throw new UserFacingError('Escalations can only be sent to a founder or a partner.')
  }

  let linkedTitle: string | null = null
  if (params.linkedType && params.linkedId) {
    linkedTitle = await resolveLinkedTitle(supabase, params.linkedType, params.linkedId)
  }

  const { error } = await supabase.from('escalations').insert({
    org_id: orgId,
    raised_by: userId,
    recipient_user_id: params.recipientUserId,
    subject,
    body: params.body?.trim() || null,
    status: 'Open',
    linked_type: params.linkedType,
    linked_id: params.linkedId,
    linked_title: linkedTitle,
  })
  if (error) throw dbFailure('save that', error)
}

export async function updateEscalationStatus(id: string, status: string) {
  const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate', 'franchise_partner'])

  const { data: esc } = await supabase
    .from('escalations')
    .select('raised_by, recipient_user_id')
    .eq('id', id)
    .single()
  if (!esc) throw new UserFacingError('Escalation not found.')

  const allowed =
    role === 'founder' || role === 'admin' ||
    esc.raised_by === userId || esc.recipient_user_id === userId
  if (!allowed) throw new UserFacingError('You cannot change the status of this escalation.')

  const resolved_at = status === 'Resolved' ? new Date().toISOString() : null
  const { error } = await supabase.from('escalations').update({ status, resolved_at }).eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/escalations')
  revalidatePath('/dashboard')
}

export async function deleteEscalation(id: string) {
  const { supabase } = await requireRole(['founder', 'admin', 'associate'])
  const { error } = await supabase.from('escalations').delete().eq('id', id)
  if (error) throw dbFailure('save that', error)
  revalidatePath('/escalations')
}

// Recipient picker — founders and partners in the org.
export async function getEscalationRecipients(): Promise<Array<{ id: string; name: string; role: string }>> {
  const { supabase } = await requireRole(['associate', 'admin'])
  const { data } = await supabase
    .from('users')
    .select('id, name, role')
    .in('role', ['founder', 'franchise_partner'])
    .order('name', { ascending: true })
  return (data ?? []) as Array<{ id: string; name: string; role: string }>
}

// "Link to" picker options, scoped by RLS to what the raiser can see.
export async function getLinkableEntities(): Promise<{
  deals: Option[]
  entries: Option[]
  tasks: Option[]
  investors: Option[]
}> {
  const { supabase } = await requireRole(['associate', 'admin'])

  const [dealsRes, entriesRes, tasksRes, investorsRes] = await Promise.all([
    supabase
      .from('active_deals')
      .select('id, entry:pipeline_entries(title)')
      .order('created_at', { ascending: false }),
    supabase
      .from('pipeline_entries')
      .select('id, title')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('id, title')
      .order('created_at', { ascending: false }),
    supabase
      .from('investors')
      .select('id, name')
      .order('name', { ascending: true }),
  ])

  const deals: Option[] = (dealsRes.data ?? []).map((d: any) => {
    const entry = Array.isArray(d.entry) ? d.entry[0] : d.entry
    return { id: d.id, label: entry?.title ?? 'Untitled deal' }
  })
  const entries: Option[] = (entriesRes.data ?? []).map((e: any) => ({ id: e.id, label: e.title ?? 'Untitled entry' }))
  const tasks: Option[] = (tasksRes.data ?? []).map((t: any) => ({ id: t.id, label: t.title }))
  const investors: Option[] = (investorsRes.data ?? []).map((i: any) => ({ id: i.id, label: i.name }))

  return { deals, entries, tasks, investors }
}
