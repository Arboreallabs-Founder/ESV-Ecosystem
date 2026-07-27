import type { SupabaseClient } from '@supabase/supabase-js'
import type { EscalationLinkedType } from './types'

// Reuses the escalations table (this app's only "notify a specific person" precedent) rather
// than a new notifications table — one escalation row per founder, since recipient_user_id is
// a single FK. Called only when an admin or hr (never a founder) approves a leave/expense
// request, so every founder finds out next time they check /escalations or the dashboard.
export async function notifyFoundersOfApproval(
  supabase: SupabaseClient,
  params: {
    orgId: string
    actorId: string
    subject: string
    body: string
    linkedType: EscalationLinkedType
    linkedId: string
    linkedTitle: string
  },
): Promise<void> {
  const { data: founders } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', params.orgId)
    .eq('role', 'founder')
  if (!founders?.length) return

  await supabase.from('escalations').insert(
    founders.map((f: { id: string }) => ({
      org_id: params.orgId,
      raised_by: params.actorId,
      recipient_user_id: f.id,
      subject: params.subject,
      body: params.body,
      status: 'Open',
      linked_type: params.linkedType,
      linked_id: params.linkedId,
      linked_title: params.linkedTitle,
    })),
  )
}
