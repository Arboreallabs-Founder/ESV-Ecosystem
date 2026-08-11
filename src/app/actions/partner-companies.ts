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

// ── The single partner intake route ──────────────────────────────────────────

/**
 * A partner submits a company.
 *
 * Creates a pipeline entry at Lead on the partner-intake pipeline — the same object a form
 * submission creates, so one board, one set of stages, one approval path. The old route wrote a
 * partner_companies row that had no stages and no way to record what happened after intake.
 *
 * The stage and pipeline are chosen here AND enforced in RLS. Belt and braces on purpose: the
 * policy is what actually stops a partner posting an entry straight into "Accepted", which is the
 * bypass this replaces.
 */
export async function submitCompanyToPipeline(input: {
  name: string
  website?: string | null
  sector?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  hq_city?: string | null
  notes?: string | null
}): Promise<{ id: string }> {
  const { supabase, userId } = await requireRole(['franchise_partner', 'founder', 'admin', 'associate'])
  const name = input.name.trim()
  if (!name) throw new Error('The company name is required.')

  const { data: pipeline, error: pErr } = await supabase
    .from('pipelines')
    .select('id, stages:pipeline_stages(id, stage_type)')
    .eq('is_partner_intake', true)
    .maybeSingle()
  if (pErr) throw pErr
  if (!pipeline) {
    throw new Error('No partner pipeline has been set up yet. Ask an admin to create one.')
  }
  const lead = ((pipeline as any).stages ?? []).find((s: any) => s.stage_type === 'lead')
  if (!lead) throw new Error('The partner pipeline has no Lead stage.')

  const { data: me } = await supabase
    .from('users').select('franchise_partner_id, name').eq('id', userId).single()

  const { data, error } = await supabase
    .from('pipeline_entries')
    .insert({
      pipeline_id: pipeline.id,
      stage_id: lead.id,
      title: name,
      submitter_name: input.contact_name?.trim() || null,
      submitter_email: input.contact_email?.trim() || null,
      sourced_by_partner_id: me?.franchise_partner_id ?? null,
      // Everything the partner typed, kept together. Whoever picks this up should not have to
      // hunt across fields for the one useful sentence.
      partner_notes: [
        input.notes?.trim(),
        input.website?.trim() ? `Website: ${input.website.trim()}` : null,
        input.sector?.trim() ? `Sector: ${input.sector.trim()}` : null,
        input.hq_city?.trim() ? `Based in: ${input.hq_city.trim()}` : null,
        input.contact_phone?.trim() ? `Phone: ${input.contact_phone.trim()}` : null,
      ].filter(Boolean).join('\n') || null,
    })
    .select('id')
    .single()
  if (error) throw error

  revalidatePath('/my-companies')
  revalidatePath('/sgp-desk')
  revalidatePath('/pipelines')
  return { id: data.id as string }
}

/**
 * A partner's own referral link.
 *
 * Always on the partner form — the RLS policy refuses any other form_id, so this cannot be pointed
 * at an internal pipeline even by mistake. Idempotent: a partner gets one link and keeps it, rather
 * than accumulating a drawer of them that all do the same thing.
 */
export async function getOrCreateMyReferralLink(): Promise<{ token: string }> {
  const { supabase, userId } = await requireRole(['franchise_partner', 'founder', 'admin', 'associate'])

  const { data: form, error: fErr } = await supabase
    .from('forms').select('id, published').eq('is_partner_form', true).maybeSingle()
  if (fErr) throw fErr
  if (!form) throw new Error('No partner form exists yet. Ask an admin to set one up.')
  if (!form.published) {
    // A link to an unpublished form returns an error to whoever opens it, which reads to the
    // recipient as us being broken.
    throw new Error('The partner form is unpublished, so a link would not work. Ask an admin to publish it.')
  }

  const { data: existing } = await supabase
    .from('form_links')
    .select('token')
    .eq('form_id', form.id)
    .eq('created_by', userId)
    .limit(1)
    .maybeSingle()
  if (existing) return { token: existing.token as string }

  const { data: me } = await supabase.from('users').select('name').eq('id', userId).single()
  const { data, error } = await supabase
    .from('form_links')
    .insert({ form_id: form.id, created_by: userId, label: me?.name ? `${me.name} — referrals` : 'Partner referrals' })
    .select('token')
    .single()
  if (error) throw error
  revalidatePath('/my-companies')
  return { token: data.token as string }
}

// ─── Intake, against the pipeline ────────────────────────────────────────────
// The Desk used to triage partner_companies rows. 20260906 moved every partner submission onto the
// Partner Sourced pipeline, so nothing new has arrived in that table since — but the Desk kept
// rendering it alongside the live queue, listing each submission twice.
//
// This is the same decision applied to the entry: move it to the stage that matches the action, and
// raise the task that carries the partner's notes to whoever picks it up. The stage is what the
// partner sees on their card, so the two can no longer disagree.

/** The stage each intake action moves the entry to. */
const INTAKE_STAGE: Record<SgpIntakeAction, string> = {
  first_call: 'First level call',
  prefunding_proposal: 'Prefunding proposal',
  discuss_with_founder: 'Founder discussion',
}

export async function intakePartnerEntry(input: {
  entryId: string
  action: SgpIntakeAction
  assignedTo: string
  supportingLinks?: SupportingLink[]
  coordinatorNotes?: string
  dueDate?: string | null
}): Promise<void> {
  const { supabase, userId, orgId } = await requireCoordinator()
  if (!orgId) throw new Error('No organization found for this account.')
  if (!input.assignedTo) throw new Error('Choose who this goes to.')

  const { data: entry } = await supabase
    .from('pipeline_entries')
    .select('id, title, partner_notes, pipeline_id, submitter_name, submitter_email')
    .eq('id', input.entryId)
    .maybeSingle()
  if (!entry) throw new Error('That submission could not be found.')
  const e = entry as {
    id: string; title: string | null; partner_notes: string | null
    pipeline_id: string; submitter_name: string | null; submitter_email: string | null
  }

  const links = (input.supportingLinks ?? [])
    .map((l) => ({ label: l.label?.trim() || '', url: l.url?.trim() || '' }))
    .filter((l) => l.url)
  for (const l of links) {
    if (!/^https?:\/\//i.test(l.url)) {
      throw new Error(`Supporting links must start with http:// or https:// — "${l.url}" does not.`)
    }
  }

  const name = e.title ?? 'Untitled'
  const actionLabel = SGP_INTAKE_ACTION_LABELS[input.action]

  // Everything the assignee needs, so they never have to come back here to find out what they are
  // being asked to do. The partner's own notes are the most useful part.
  const description = [
    `Partner-sourced company: ${name}.`,
    e.submitter_name || e.submitter_email
      ? `Contact: ${[e.submitter_name, e.submitter_email].filter(Boolean).join(' — ')}` : null,
    e.partner_notes ? `\nPartner's notes:\n${e.partner_notes}` : null,
    input.coordinatorNotes?.trim() ? `\nCoordinator:\n${input.coordinatorNotes.trim()}` : null,
    links.length ? `\nSupporting links:\n${links.map((l) => `- ${l.label || 'Link'}: ${l.url}`).join('\n')}` : null,
  ].filter(Boolean).join('\n')

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      title: `${actionLabel} — ${name}`,
      description,
      assignee_id: input.assignedTo,
      assigned_by_id: userId,
      created_by: userId,
      link_url: links[0]?.url ?? null,
      due_date: input.dueDate || null,
      priority: input.action === 'discuss_with_founder' ? 'High' : 'Medium',
      status: 'To Do',
    })
    .select('id')
    .single()
  if (taskError) throw taskError

  // Move the card. This is what the partner sees, so it is the part that must not be skipped —
  // and it is why the task is created first: a task with no stage move is recoverable, a stage
  // move with no task silently drops the handoff.
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', e.pipeline_id)
    .eq('name', INTAKE_STAGE[input.action])
    .maybeSingle()

  if (stage) {
    const { data: moved, error: moveErr } = await supabase
      .from('pipeline_entries')
      .update({ stage_id: (stage as { id: string }).id })
      .eq('id', input.entryId)
      .select('id')
    if (moveErr) throw moveErr
    // An RLS-filtered update reports success having changed nothing.
    if (!moved || moved.length === 0) throw new Error('That submission could not be moved.')
  }

  // Also add the assignee to the entry, so "who is on this" is answerable from the board.
  await supabase
    .from('pipeline_entry_assignees')
    .upsert({ entry_id: input.entryId, user_id: input.assignedTo }, { onConflict: 'entry_id,user_id' })

  revalidatePath('/sgp-desk')
  revalidatePath('/my-companies')
  revalidatePath('/tasks')
}
