'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { SGP_INTAKE_ACTION_LABELS } from '@/lib/types'
import type { SgpIntakeAction, SupportingLink } from '@/lib/types'

/* Partner company submissions and coordinator triage.

   The RLS policies enforce all of this independently; these guards exist so a refusal arrives as
   a readable message instead of a silent zero-row write. */

async function requireCoordinator() {
  const ctx = await requireRole(['founder', 'admin', 'associate'])
  const { data } = await ctx.supabase
    .from('users')
    .select('is_sgp_coordinator')
    .eq('id', ctx.userId)
    .maybeSingle()

  const isCoordinator = !!(data as { is_sgp_coordinator?: boolean } | null)?.is_sgp_coordinator
  // Founders and admins can always triage; an associate needs the flag.
  if (!isCoordinator && !['founder', 'admin'].includes(ctx.role)) {
    throw new Error('Only an SGP Coordinator can intake partner submissions.')
  }
  return ctx
}

export type PartnerCompanyInput = {
  name: string
  website?: string | null
  sector?: string | null
  hq_city?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  partner_comments?: string | null
}

/**
 * A partner (or internal staff on their behalf) logs a company.
 *
 * Only the name is required. The point is to capture a lead while it is fresh — demanding a
 * complete form is how leads end up in someone's notebook instead.
 */
export async function submitPartnerCompany(input: PartnerCompanyInput): Promise<string> {
  const { supabase, userId, orgId } = await requireRole([
    'franchise_partner', 'founder', 'admin', 'associate',
  ])
  if (!orgId) throw new Error('No organization found for this account.')

  const name = input.name?.trim()
  if (!name) throw new Error('The company name is required.')

  // Denormalised so attribution survives the submitter leaving the org.
  const { data: me } = await supabase
    .from('users')
    .select('franchise_partner_id')
    .eq('id', userId)
    .maybeSingle()

  const text = (v: string | null | undefined) => v?.trim() || null

  const { data, error } = await supabase
    .from('partner_companies')
    .insert({
      org_id: orgId,
      submitted_by: userId,
      partner_id: (me as { franchise_partner_id?: string | null } | null)?.franchise_partner_id ?? null,
      name,
      website: text(input.website),
      sector: text(input.sector),
      hq_city: text(input.hq_city),
      contact_name: text(input.contact_name),
      contact_email: text(input.contact_email),
      contact_phone: text(input.contact_phone),
      partner_comments: text(input.partner_comments),
    })
    .select('id')
    .single()
  if (error) throw error

  revalidatePath('/portal')
  revalidatePath('/sgp-desk')
  return data.id as string
}

export type IntakeInput = {
  submissionId: string
  action: SgpIntakeAction
  assignedTo: string
  supportingLinks?: SupportingLink[]
  coordinatorNotes?: string | null
  dueDate?: string | null
}

/**
 * Coordinator intake: choose what happens next, hand it to someone, attach references.
 *
 * This creates a real Task on the existing board rather than a private to-do inside this module.
 * The assignee already lives on that board — it drives their alerts, their KPI numbers and their
 * weekly update — so a parallel list would be one more place for work to be forgotten.
 */
export async function intakePartnerCompany(input: IntakeInput): Promise<void> {
  const { supabase, userId, orgId } = await requireCoordinator()
  if (!orgId) throw new Error('No organization found for this account.')
  if (!input.assignedTo) throw new Error('Choose who this goes to.')

  const { data: submission } = await supabase
    .from('partner_companies')
    .select('id, name, status, task_id, partner_comments, website')
    .eq('id', input.submissionId)
    .maybeSingle()
  if (!submission) throw new Error('That submission could not be found.')
  if ((submission as { status: string }).status === 'closed') {
    throw new Error('That submission has been closed.')
  }

  const links = (input.supportingLinks ?? [])
    .map((l) => ({ label: l.label?.trim() || '', url: l.url?.trim() || '' }))
    .filter((l) => l.url)

  for (const l of links) {
    if (!/^https?:\/\//i.test(l.url)) {
      throw new Error(`Supporting links must start with http:// or https:// — "${l.url}" does not.`)
    }
  }

  const name = (submission as { name: string }).name
  const actionLabel = SGP_INTAKE_ACTION_LABELS[input.action]

  // The task body carries everything the assignee needs, so they never have to come back here to
  // find out what they are being asked to do.
  const descriptionParts = [
    `Partner-sourced company: ${name}.`,
    (submission as { website: string | null }).website
      ? `Website: ${(submission as { website: string | null }).website}` : null,
    (submission as { partner_comments: string | null }).partner_comments
      ? `\nPartner's notes:\n${(submission as { partner_comments: string | null }).partner_comments}` : null,
    input.coordinatorNotes?.trim() ? `\nCoordinator:\n${input.coordinatorNotes.trim()}` : null,
    links.length ? `\nSupporting links:\n${links.map((l) => `- ${l.label || 'Link'}: ${l.url}`).join('\n')}` : null,
  ].filter(Boolean)

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      title: `${actionLabel} — ${name}`,
      description: descriptionParts.join('\n'),
      assignee_id: input.assignedTo,
      assigned_by_id: userId,
      created_by: userId,
      // tasks carries a single link; the rest are in the description above.
      link_url: links[0]?.url ?? null,
      due_date: input.dueDate || null,
      priority: input.action === 'discuss_with_founder' ? 'High' : 'Medium',
      status: 'To Do',
    })
    .select('id')
    .single()
  if (taskError) throw taskError

  const { error } = await supabase
    .from('partner_companies')
    .update({
      status: 'assigned',
      intake_action: input.action,
      coordinator_id: userId,
      coordinator_notes: input.coordinatorNotes?.trim() || null,
      supporting_links: links,
      assigned_to: input.assignedTo,
      assigned_at: new Date().toISOString(),
      task_id: task.id,
    })
    .eq('id', input.submissionId)
  if (error) throw error

  revalidatePath('/sgp-desk')
  revalidatePath('/portal')
  revalidatePath('/tasks')
}

/** End a submission without deleting it — the partner's contribution stays on record. */
export async function closePartnerCompany(submissionId: string, reason: string): Promise<void> {
  const { supabase } = await requireCoordinator()
  const text = reason.trim()
  if (!text) throw new Error('Give a reason so the partner knows what happened.')

  const { error } = await supabase
    .from('partner_companies')
    .update({ status: 'closed', closed_reason: text })
    .eq('id', submissionId)
  if (error) throw error

  revalidatePath('/sgp-desk')
  revalidatePath('/portal')
}

/** Toggle the coordinator flag. Founder/admin only — it decides who sees the whole queue. */
export async function setSgpCoordinator(targetUserId: string, isCoordinator: boolean): Promise<void> {
  const { supabase } = await requireRole(['founder', 'admin'])
  const { error } = await supabase
    .from('users')
    .update({ is_sgp_coordinator: isCoordinator })
    .eq('id', targetUserId)
  if (error) throw error

  revalidatePath('/admin/users')
  revalidatePath('/sgp-desk')
}
