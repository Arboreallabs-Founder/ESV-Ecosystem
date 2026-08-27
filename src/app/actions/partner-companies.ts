'use server'

import { UserFacingError } from '@/lib/action-errors'
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
    throw new UserFacingError('Only an SGP Coordinator can intake partner submissions.')
  }
  return ctx
}

/* The old partner_companies intake — submitPartnerCompany, intakePartnerCompany and
   closePartnerCompany — lived here. 20260906 moved every partner submission onto the Partner
   Sourced pipeline and nothing has called them since; 20260919 renamed the table out from under
   them. Removed rather than left as a second, broken way to do what submitCompanyToPipeline and
   intakePartnerEntry below already do. */

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
  if (!name) throw new UserFacingError('The company name is required.')

  const { data: pipeline, error: pErr } = await supabase
    .from('pipelines')
    .select('id, stages:pipeline_stages(id, stage_type)')
    .eq('is_partner_intake', true)
    .maybeSingle()
  if (pErr) throw pErr
  if (!pipeline) {
    throw new UserFacingError('No partner pipeline has been set up yet. Ask an admin to create one.')
  }
  const lead = ((pipeline as any).stages ?? []).find((s: any) => s.stage_type === 'lead')
  if (!lead) throw new UserFacingError('The partner pipeline has no Lead stage.')

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
  if (!form) throw new UserFacingError('No partner form exists yet. Ask an admin to set one up.')
  if (!form.published) {
    // A link to an unpublished form returns an error to whoever opens it, which reads to the
    // recipient as us being broken.
    throw new UserFacingError('The partner form is unpublished, so a link would not work. Ask an admin to publish it.')
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
  if (!orgId) throw new UserFacingError('No organization found for this account.')
  if (!input.assignedTo) throw new UserFacingError('Choose who this goes to.')

  const { data: entry } = await supabase
    .from('pipeline_entries')
    .select('id, title, partner_notes, pipeline_id, submitter_name, submitter_email')
    .eq('id', input.entryId)
    .maybeSingle()
  if (!entry) throw new UserFacingError('That submission could not be found.')
  const e = entry as {
    id: string; title: string | null; partner_notes: string | null
    pipeline_id: string; submitter_name: string | null; submitter_email: string | null
  }

  const links = (input.supportingLinks ?? [])
    .map((l) => ({ label: l.label?.trim() || '', url: l.url?.trim() || '' }))
    .filter((l) => l.url)
  for (const l of links) {
    if (!/^https?:\/\//i.test(l.url)) {
      throw new UserFacingError(`Supporting links must start with http:// or https:// — "${l.url}" does not.`)
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
    if (!moved || moved.length === 0) throw new UserFacingError('That submission could not be moved.')
  }

  // Also add the assignee to the entry, so "who is on this" is answerable from the board.
  await supabase
    .from('pipeline_entry_assignees')
    .upsert({ entry_id: input.entryId, user_id: input.assignedTo }, { onConflict: 'entry_id,user_id' })

  revalidatePath('/sgp-desk')
  revalidatePath('/my-companies')
  revalidatePath('/tasks')
}
