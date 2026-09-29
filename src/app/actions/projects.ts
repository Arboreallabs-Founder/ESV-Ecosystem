'use server'

import { revalidatePath } from 'next/cache'
import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { requireRole } from '@/lib/guards'
import { findOrCreateCompanyByName } from '@/lib/company-sync'
import {
  CHECKLIST_TEMPLATES, MEMBER_ROLES, PROJECT_STAGES, SERVICES, STAGE_META, serviceLabel, trackFor,
  type ProjectMemberRole, type ProjectService, type ProjectStage, type TrackStep,
} from '@/lib/project-model'

/* Projects (20261014000000). Every action that moves a project logs it on the timeline and then
   calls sync_project_tasks, which raises the next step's task and closes the ones it moved past —
   so the task board follows the project without anyone creating tasks by hand. RLS
   (can_see_project) and the guard trigger decide access; checks here exist to say why in words. */

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']
const LEADS = ['founder', 'admin']

type Ctx = Awaited<ReturnType<typeof requireRole>>

async function ctx() {
  return requireRole(INTERNAL)
}

function refresh(projectId?: string) {
  revalidatePath('/projects')
  if (projectId) revalidatePath(`/projects/${projectId}`)
  revalidatePath('/tasks')
}

async function logEvent(c: Ctx, projectId: string, kind: 'stage' | 'step' | 'payment' | 'change' | 'note', body: string) {
  const { error } = await c.supabase.from('project_events').insert({ project_id: projectId, kind, body, created_by: c.userId })
  if (error) console.error('[projects] event log failed:', error.message)
}

async function syncTasks(c: Ctx, projectId: string) {
  const { error } = await c.supabase.rpc('sync_project_tasks', { p_project: projectId })
  // The project moved either way; a task sync failure is surfaced in the log, not as a failed move.
  if (error) console.error('[projects] task sync failed:', error.message)
}

async function loadProject(c: Ctx, id: string) {
  const { data, error } = await c.supabase.from('projects')
    .select('id, name, stage, org_id, company_id, drive_url, advance_received_at, balance_received_at, changes_used, proposal_sent_at')
    .eq('id', id).maybeSingle()
  if (error) throw dbFailure('load the project', error)
  if (!data) throw new UserFacingError('That project could not be found.')
  return data as {
    id: string; name: string; stage: ProjectStage; org_id: string; company_id: string | null; drive_url: string | null
    advance_received_at: string | null; balance_received_at: string | null; changes_used: number; proposal_sent_at: string | null
  }
}

async function moveStage(c: Ctx, id: string, from: ProjectStage, to: ProjectStage, extra: Record<string, unknown> = {}, note?: string) {
  const { error } = await c.supabase.from('projects')
    .update({ stage: to, stage_changed_at: new Date().toISOString(), ...extra })
    .eq('id', id)
  if (error) throw dbFailure('move the project on', error)
  await logEvent(c, id, 'stage', note ?? `${STAGE_META[from].label} → ${STAGE_META[to].label}`)
}

async function isProjectLead(c: Ctx, projectId: string) {
  const { data } = await c.supabase.from('project_members').select('id')
    .eq('project_id', projectId).eq('user_id', c.userId).eq('role', 'lead').limit(1)
  return (data ?? []).length > 0
}

// ── Creating ─────────────────────────────────────────────────────────────────

export async function createProject(input: {
  name: string
  companyId?: string | null
  connectIds?: string[]
  leadIds?: string[]
  services?: ProjectService[]
  notes?: string | null
}): Promise<string> {
  const c = await ctx()
  if (c.isExternal) throw new UserFacingError('External users can work on projects they are added to, but not start new ones.')
  const name = input.name.trim()
  if (!name) throw new UserFacingError('Give the project a name, usually the company name.')

  // Every lead goes into Companies, whether the proposal is accepted or not.
  let companyId = input.companyId || null
  if (!companyId) {
    try {
      companyId = (await findOrCreateCompanyByName(c.supabase, c.orgId, c.userId, name))?.id ?? null
    } catch (e) {
      console.error('[projects] company create/link failed:', e)
    }
  }

  // The id is made here rather than read back with .select(): the read-back is checked against the
  // SELECT policy, can_see_project(), which looks the project up in the table — and a row being
  // inserted isn't visible to that lookup yet, so the insert was refused (42501) for everyone.
  const id = crypto.randomUUID()
  const { error } = await c.supabase.from('projects')
    .insert({ id, org_id: c.orgId, name, company_id: companyId, notes: input.notes?.trim() || null, created_by: c.userId })
  if (error) throw dbFailure('create the project', error)

  const members = [
    ...(input.connectIds ?? []).map((u) => ({ project_id: id, user_id: u, role: 'connect' })),
    ...(input.leadIds ?? []).map((u) => ({ project_id: id, user_id: u, role: 'lead' })),
  ]
  if (members.length) {
    const { error: mErr } = await c.supabase.from('project_members').insert(members)
    if (mErr) console.error('[projects] members insert failed:', mErr.message)
  }
  const services = (input.services ?? []).filter((s) => s !== 'custom')
  if (services.length) {
    const { error: sErr } = await c.supabase.from('project_services')
      .insert(services.map((s, i) => ({ project_id: id, service: s, position: i })))
    if (sErr) console.error('[projects] services insert failed:', sErr.message)
  }

  await logEvent(c, id, 'stage', 'Project created as a lead.')
  await syncTasks(c, id)
  refresh(id)
  return id
}

export async function updateProjectBasics(id: string, patch: { name?: string; drive_url?: string | null; proposal_url?: string | null; notes?: string | null }) {
  const c = await ctx()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new UserFacingError('The project needs a name.')
    update.name = patch.name.trim()
  }
  for (const key of ['drive_url', 'proposal_url', 'notes'] as const) {
    if (patch[key] !== undefined) update[key] = patch[key]?.trim() || null
  }
  for (const key of ['drive_url', 'proposal_url'] as const) {
    const v = update[key]
    if (typeof v === 'string' && !/^https?:\/\//i.test(v)) update[key] = `https://${v}`
  }
  const { error } = await c.supabase.from('projects').update(update).eq('id', id)
  if (error) throw dbFailure('save that', error)
  if (patch.drive_url !== undefined && update.drive_url) await logEvent(c, id, 'note', 'Google Drive folder linked.')
  await syncTasks(c, id)
  refresh(id)
}

export async function deleteProject(id: string) {
  const c = await ctx()
  if (!LEADS.includes(c.role)) throw new UserFacingError('Only a founder or admin can delete a project.')
  const { error } = await c.supabase.from('projects').delete().eq('id', id)
  if (error) throw dbFailure('delete the project', error)
  refresh()
}

// ── Stakeholders ─────────────────────────────────────────────────────────────

/** Replace who holds one role. The same person can hold several roles; each is its own row. */
export async function setProjectRole(id: string, role: ProjectMemberRole, userIds: string[]) {
  const c = await ctx()
  if (!MEMBER_ROLES.includes(role)) throw new UserFacingError('Unknown role.')
  const unique = [...new Set(userIds)]
  const { data: current, error: rErr } = await c.supabase.from('project_members')
    .select('id, user_id').eq('project_id', id).eq('role', role)
  if (rErr) throw dbFailure('load the team', rErr)
  const have = new Set((current ?? []).map((m) => m.user_id as string))
  const toRemove = (current ?? []).filter((m) => !unique.includes(m.user_id as string)).map((m) => m.id as string)
  const toAdd = unique.filter((u) => !have.has(u))
  if (toRemove.length) {
    const { error } = await c.supabase.from('project_members').delete().in('id', toRemove)
    if (error) throw dbFailure('update the team', error)
  }
  if (toAdd.length) {
    const { error } = await c.supabase.from('project_members').insert(toAdd.map((u) => ({ project_id: id, user_id: u, role })))
    if (error) throw dbFailure('update the team', error)
  }
  await syncTasks(c, id)
  refresh(id)
}

export async function setProjectPartner(id: string, partnerId: string | null) {
  const c = await ctx()
  if (!LEADS.includes(c.role)) throw new UserFacingError('Only a founder or admin can credit a partner.')
  const { error } = await c.supabase.from('projects').update({ partner_id: partnerId }).eq('id', id)
  if (error) throw dbFailure('credit the partner', error)
  await logEvent(c, id, 'note', partnerId ? 'Partner credited. They can now follow the project on their portal.' : 'Partner credit removed.')
  refresh(id)
}

// ── Services (the cart) ──────────────────────────────────────────────────────

export async function addProjectService(id: string, service: ProjectService, label?: string | null, price?: number | null) {
  const c = await ctx()
  if (!SERVICES.includes(service)) throw new UserFacingError('Unknown service.')
  if (service === 'custom' && !label?.trim()) throw new UserFacingError('Describe the custom engagement.')
  const p = await loadProject(c, id)
  const { count } = await c.supabase.from('project_services').select('id', { count: 'exact', head: true }).eq('project_id', id)
  const { error } = await c.supabase.from('project_services').insert({
    project_id: id, service, label: label?.trim() || null, price_inr: price ?? null, position: count ?? 0,
  })
  if (error) throw dbFailure('add that service', error)
  // Added after acceptance: its data items join the checklist.
  if (['data', 'advance', 'work'].includes(p.stage)) await seedChecklist(c, id, [service])
  await logEvent(c, id, 'note', `Added ${serviceLabel(service, label)} to the engagement.`)
  await syncTasks(c, id)
  refresh(id)
}

export async function updateProjectService(serviceId: string, patch: { label?: string | null; price_inr?: number | null }) {
  const c = await ctx()
  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) update.label = patch.label?.trim() || null
  if (patch.price_inr !== undefined) {
    if (patch.price_inr != null && (!Number.isFinite(patch.price_inr) || patch.price_inr < 0)) throw new UserFacingError('Enter a price of zero or more.')
    update.price_inr = patch.price_inr
  }
  const { data, error } = await c.supabase.from('project_services').update(update).eq('id', serviceId).select('project_id').single()
  if (error) throw dbFailure('save that', error)
  refresh(data.project_id as string)
}

export async function removeProjectService(serviceId: string) {
  const c = await ctx()
  const { data: s, error: sErr } = await c.supabase.from('project_services').select('project_id, service, label, step').eq('id', serviceId).single()
  if (sErr) throw dbFailure('load that service', sErr)
  if (s.step !== 'not_started') throw new UserFacingError('Work on this service has started, so it can’t be removed.')
  const { error } = await c.supabase.from('project_services').delete().eq('id', serviceId)
  if (error) throw dbFailure('remove that service', error)
  await logEvent(c, s.project_id as string, 'note', `Removed ${serviceLabel(s.service as ProjectService, s.label as string | null)} from the engagement.`)
  await syncTasks(c, s.project_id as string)
  refresh(s.project_id as string)
}

// ── The shared stages ────────────────────────────────────────────────────────

export async function scheduleFirstCall(id: string, when: string | null) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'lead' && p.stage !== 'first_call') throw new UserFacingError('The first call is already behind this project.')
  const at = when ? new Date(when).toISOString() : null
  if (p.stage === 'lead') {
    await moveStage(c, id, 'lead', 'first_call', { first_call_at: at }, at ? `First call set for ${new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.` : undefined)
  } else {
    const { error } = await c.supabase.from('projects').update({ first_call_at: at }).eq('id', id)
    if (error) throw dbFailure('save the call date', error)
  }
  await syncTasks(c, id)
  refresh(id)
}

export async function completeFirstCall(id: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'first_call' && p.stage !== 'lead') throw new UserFacingError('This project is already past the first call.')
  await moveStage(c, id, p.stage, 'proposal', {}, 'First call done. Building the proposal.')
  await syncTasks(c, id)
  refresh(id)
}

export async function markProposalSent(id: string, url: string | null) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'proposal') throw new UserFacingError('The project isn’t at the proposal stage.')
  const { count } = await c.supabase.from('project_services').select('id', { count: 'exact', head: true }).eq('project_id', id)
  if (!count) throw new UserFacingError('Add at least one service to the cart before sending the proposal.')
  let link = url?.trim() || null
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`
  const { error } = await c.supabase.from('projects')
    .update({ proposal_sent_at: new Date().toISOString(), ...(link ? { proposal_url: link } : {}) }).eq('id', id)
  if (error) throw dbFailure('mark the proposal sent', error)
  await logEvent(c, id, 'stage', 'Proposal sent.')
  await syncTasks(c, id)
  refresh(id)
}

async function seedChecklist(c: Ctx, id: string, services: ProjectService[]) {
  const { data: existing } = await c.supabase.from('project_checklist_items').select('label, position').eq('project_id', id)
  const seen = new Set((existing ?? []).map((e) => (e.label as string).toLowerCase()))
  let pos = Math.max(0, ...(existing ?? []).map((e) => e.position as number)) + 1
  const rows: Array<Record<string, unknown>> = []
  for (const s of services) {
    for (const item of CHECKLIST_TEMPLATES[s]) {
      const key = item.label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ project_id: id, service: s, label: item.label, optional: !!item.optional, position: pos++, updated_by: c.userId })
    }
  }
  if (rows.length) {
    const { error } = await c.supabase.from('project_checklist_items').insert(rows)
    if (error) throw dbFailure('build the data checklist', error)
  }
}

export async function acceptProposal(id: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'proposal') throw new UserFacingError('The project isn’t at the proposal stage.')
  const { data: services, error: sErr } = await c.supabase.from('project_services').select('service').eq('project_id', id)
  if (sErr) throw dbFailure('load the services', sErr)
  if (!services?.length) throw new UserFacingError('Add the services they accepted before marking the proposal accepted.')
  await seedChecklist(c, id, [...new Set(services.map((s) => s.service as ProjectService))])
  await moveStage(c, id, 'proposal', 'data', { proposal_decided_at: new Date().toISOString(), rejection_reason: null }, 'Proposal accepted. Gathering data.')
  if (p.company_id) {
    // Accepted engagements are live work — the company profile should say so.
    await c.supabase.from('companies').update({ status: 'active' }).eq('id', p.company_id).in('status', ['prospect', 'screening', 'passed', 'dead'])
  }
  await syncTasks(c, id)
  refresh(id)
}

export async function rejectProposal(id: string, reason: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (!['lead', 'first_call', 'proposal'].includes(p.stage)) throw new UserFacingError('Only a project that hasn’t started can be marked declined.')
  if (!reason.trim()) throw new UserFacingError('Say why they declined, so the lead is useful if they come back.')
  await moveStage(c, id, p.stage, 'dormant', { proposal_decided_at: new Date().toISOString(), rejection_reason: reason.trim() }, `Went dormant: ${reason.trim()}`)
  await syncTasks(c, id)
  refresh(id)
}

export async function reviveProject(id: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'dormant') throw new UserFacingError('This project isn’t dormant.')
  await moveStage(c, id, 'dormant', 'proposal', { proposal_decided_at: null, proposal_sent_at: null }, 'Revived. Back at the proposal stage.')
  await syncTasks(c, id)
  refresh(id)
}

/** Data → advance (or straight to work if the advance is already in). Gated on the checklist and
    the Drive folder, the two things the proposals make a condition of starting. */
export async function finishDataGathering(id: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'data') throw new UserFacingError('The project isn’t at the data stage.')
  const { count: pending } = await c.supabase.from('project_checklist_items').select('id', { count: 'exact', head: true })
    .eq('project_id', id).eq('status', 'pending')
  if (pending) throw new UserFacingError(`${pending} data item${pending === 1 ? ' is' : 's are'} still outstanding. Mark each one received, or not applicable.`)
  if (!p.drive_url) throw new UserFacingError('Link the project’s Google Drive folder first.')
  if (p.advance_received_at) {
    await moveStage(c, id, 'data', 'work', { work_started_at: new Date().toISOString() }, 'Data complete and the advance is in. Work has started.')
  } else {
    await moveStage(c, id, 'data', 'advance', {}, 'Data complete. Waiting on the advance.')
  }
  await syncTasks(c, id)
  refresh(id)
}

export async function recordPayment(id: string, kind: 'advance' | 'balance', amount: number | null, receivedOn: string | null) {
  const c = await ctx()
  if (!LEADS.includes(c.role) && !(await isProjectLead(c, id))) {
    throw new UserFacingError('Only a founder, an admin or the project lead can record a payment.')
  }
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) throw new UserFacingError('Enter the amount received.')
  const p = await loadProject(c, id)
  const at = receivedOn ? new Date(receivedOn).toISOString() : new Date().toISOString()
  const { error } = await c.supabase.from('projects')
    .update(kind === 'advance' ? { advance_received_at: at, advance_amount_inr: amount } : { balance_received_at: at, balance_amount_inr: amount })
    .eq('id', id)
  if (error) throw dbFailure('record the payment', error)
  await logEvent(c, id, 'payment', `${kind === 'advance' ? 'Advance' : 'Balance'} received${amount != null ? `: ₹${Math.round(amount).toLocaleString('en-IN')}` : ''}.`)
  if (kind === 'advance' && p.stage === 'advance') {
    await moveStage(c, id, 'advance', 'work', { work_started_at: new Date().toISOString() }, 'Advance received. Work has started.')
  }
  await syncTasks(c, id)
  refresh(id)
}

export async function clearPayment(id: string, kind: 'advance' | 'balance') {
  const c = await ctx()
  if (!LEADS.includes(c.role)) throw new UserFacingError('Only a founder or admin can undo a recorded payment.')
  const { error } = await c.supabase.from('projects')
    .update(kind === 'advance' ? { advance_received_at: null, advance_amount_inr: null } : { balance_received_at: null, balance_amount_inr: null })
    .eq('id', id)
  if (error) throw dbFailure('undo the payment', error)
  await logEvent(c, id, 'payment', `${kind === 'advance' ? 'Advance' : 'Balance'} payment record removed.`)
  await syncTasks(c, id)
  refresh(id)
}

// ── Service tracks ───────────────────────────────────────────────────────────

export async function moveServiceStep(serviceId: string, direction: 'forward' | 'back') {
  const c = await ctx()
  const { data: s, error: sErr } = await c.supabase.from('project_services')
    .select('id, project_id, service, label, step').eq('id', serviceId).single()
  if (sErr) throw dbFailure('load that service', sErr)
  const projectId = s.project_id as string
  const p = await loadProject(c, projectId)
  if (p.stage !== 'work' && !(direction === 'back' && p.stage === 'handover')) {
    throw new UserFacingError(p.stage === 'advance' || p.stage === 'data'
      ? 'Work starts once the data is in and the advance is received.'
      : 'The project isn’t in progress.')
  }

  const track = trackFor(s.service as ProjectService).map((t) => t.step)
  const i = track.indexOf(s.step as TrackStep)
  const next = direction === 'forward' ? track[i + 1] : track[i - 1]
  if (!next) throw new UserFacingError(direction === 'forward' ? 'This service is already complete.' : 'This service hasn’t started.')
  if (next === 'final' && !p.balance_received_at) {
    throw new UserFacingError('The final goes out once the balance is received. Record the balance payment first.')
  }

  const { error } = await c.supabase.from('project_services')
    .update({ step: next, step_changed_at: new Date().toISOString() }).eq('id', serviceId)
  if (error) throw dbFailure('move the service on', error)
  const label = serviceLabel(s.service as ProjectService, s.label as string | null)
  const stepLabel = trackFor(s.service as ProjectService).find((t) => t.step === next)?.label ?? next
  await logEvent(c, projectId, 'step', direction === 'forward' ? `${label}: ${stepLabel}.` : `${label}: moved back to ${stepLabel.toLowerCase()}.`)

  // Everything final → handover. Anything moved back out of final during handover → back to work.
  const { data: all } = await c.supabase.from('project_services').select('step').eq('project_id', projectId)
  const allFinal = (all ?? []).length > 0 && (all ?? []).every((x) => x.step === 'final')
  if (p.stage === 'work' && allFinal) {
    await moveStage(c, projectId, 'work', 'handover', {}, 'Every deliverable is final. Handing over.')
  } else if (p.stage === 'handover' && !allFinal) {
    await moveStage(c, projectId, 'handover', 'work')
  }
  await syncTasks(c, projectId)
  refresh(projectId)
}

// ── After handover ───────────────────────────────────────────────────────────

export async function logChangeRequest(id: string, note: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (!['handover', 'completed'].includes(p.stage)) throw new UserFacingError('Changes are counted after handover.')
  if (p.changes_used >= 2) throw new UserFacingError('Both post-handover changes have been used. Anything further is a new engagement.')
  if (!note.trim()) throw new UserFacingError('Say what they asked to change.')
  const { error } = await c.supabase.from('projects').update({ changes_used: p.changes_used + 1 }).eq('id', id)
  if (error) throw dbFailure('log the change', error)
  await logEvent(c, id, 'change', `Change ${p.changes_used + 1} of 2: ${note.trim()}`)
  refresh(id)
}

export async function completeProject(id: string) {
  const c = await ctx()
  const p = await loadProject(c, id)
  if (p.stage !== 'handover') throw new UserFacingError('A project is completed after handover.')
  await moveStage(c, id, 'handover', 'completed', {}, 'Project completed.')
  await syncTasks(c, id)
  refresh(id)
}

/** Founder/admin correction, e.g. for projects moved over from Active Deals. No gates. */
export async function overrideStage(id: string, stage: ProjectStage) {
  const c = await ctx()
  if (!LEADS.includes(c.role)) throw new UserFacingError('Only a founder or admin can set the stage directly.')
  if (![...PROJECT_STAGES, 'dormant'].includes(stage)) throw new UserFacingError('Unknown stage.')
  const p = await loadProject(c, id)
  if (p.stage === stage) return
  const extra: Record<string, unknown> = {}
  if (stage === 'work') extra.work_started_at = new Date().toISOString()
  await moveStage(c, id, p.stage, stage, extra, `Stage set to ${STAGE_META[stage].label} by hand.`)
  await syncTasks(c, id)
  refresh(id)
}

// ── Data checklist ───────────────────────────────────────────────────────────

export async function setChecklistStatus(itemId: string, status: 'pending' | 'received' | 'na') {
  const c = await ctx()
  const { data, error } = await c.supabase.from('project_checklist_items')
    .update({ status, updated_by: c.userId, updated_at: new Date().toISOString() })
    .eq('id', itemId).select('project_id').single()
  if (error) throw dbFailure('update that item', error)
  refresh(data.project_id as string)
}

/** "Received all data required": every item still pending becomes received in one go. Items
    already marked N/A stay N/A — the client said those don't apply, which isn't the same as sent. */
export async function markAllChecklistReceived(projectId: string) {
  const c = await ctx()
  const { data, error } = await c.supabase.from('project_checklist_items')
    .update({ status: 'received', updated_by: c.userId, updated_at: new Date().toISOString() })
    .eq('project_id', projectId).eq('status', 'pending')
    .select('id')
  if (error) throw dbFailure('mark the data received', error)
  if (data?.length) await logEvent(c, projectId, 'note', `All required data received (${data.length} item${data.length === 1 ? '' : 's'} ticked).`)
  refresh(projectId)
}

export async function addChecklistItem(projectId: string, label: string, service: ProjectService | null) {
  const c = await ctx()
  if (!label.trim()) throw new UserFacingError('Describe what you need from them.')
  const { data: last } = await c.supabase.from('project_checklist_items').select('position')
    .eq('project_id', projectId).order('position', { ascending: false }).limit(1)
  const { error } = await c.supabase.from('project_checklist_items').insert({
    project_id: projectId, label: label.trim(), service, position: ((last?.[0]?.position as number | undefined) ?? 0) + 1, updated_by: c.userId,
  })
  if (error) throw dbFailure('add that item', error)
  refresh(projectId)
}

export async function removeChecklistItem(itemId: string) {
  const c = await ctx()
  const { data, error } = await c.supabase.from('project_checklist_items').delete().eq('id', itemId).select('project_id').single()
  if (error) throw dbFailure('remove that item', error)
  refresh(data.project_id as string)
}

// ── Notes ────────────────────────────────────────────────────────────────────

export async function addProjectNote(id: string, body: string) {
  const c = await ctx()
  if (!body.trim()) return
  await logEvent(c, id, 'note', body.trim())
  refresh(id)
}
