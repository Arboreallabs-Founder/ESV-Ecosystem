import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  ProjectChecklistItem, ProjectDetail, ProjectEvent, ProjectMember, ProjectServiceRow, ProjectSummary, ProjectTask,
} from '@/lib/project-model'

/* Reads for Projects (20261014000000). RLS decides who sees what (can_see_project); every read
   checks its error rather than rendering an empty page that looks like "no projects". */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

const SUMMARY_SELECT = `
  id, name, stage, stage_changed_at, created_at,
  company:companies!company_id(id, name, logo_url),
  partner:franchise_partners!partner_id(id, name),
  members:project_members(id, user_id, role, created_at, user:users!user_id(name, email, photo_url)),
  services:project_services(id, service, label, price_inr, position, step, step_changed_at, created_at),
  checklist:project_checklist_items(status)
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(r: any): ProjectSummary {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: ProjectMember[] = ((r.members ?? []) as any[])
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((m) => {
      const u = one(m.user) as { name: string | null; email: string | null; photo_url: string | null } | null
      return { id: m.id, user_id: m.user_id, role: m.role, name: u?.name ?? null, email: u?.email ?? null, photo_url: u?.photo_url ?? null }
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services: ProjectServiceRow[] = ((r.services ?? []) as any[])
    .sort((a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at)))
    .map((s) => ({ id: s.id, service: s.service, label: s.label, price_inr: s.price_inr == null ? null : Number(s.price_inr), position: s.position, step: s.step, step_changed_at: s.step_changed_at }))
  const checklist = (r.checklist ?? []) as Array<{ status: string }>
  return {
    id: r.id,
    name: r.name,
    stage: r.stage,
    stage_changed_at: r.stage_changed_at,
    created_at: r.created_at,
    company: one(r.company),
    partner: one(r.partner),
    members,
    services,
    checklist_total: checklist.length,
    checklist_done: checklist.filter((c) => c.status !== 'pending').length,
  }
}

export const fetchProjects = cache(async (): Promise<ProjectSummary[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('projects').select(SUMMARY_SELECT).order('created_at', { ascending: false })
  if (error) throw new Error(`Could not load projects: ${error.message}`)
  return (data ?? []).map(toSummary)
})

export const fetchProject = cache(async (id: string): Promise<ProjectDetail | null> => {
  const supabase = await createClient()
  const [{ data: p, error }, { data: items, error: itemsErr }, { data: events, error: eventsErr }, { data: tasks, error: tasksErr }] = await Promise.all([
    supabase.from('projects').select(`
      ${SUMMARY_SELECT},
      first_call_at, proposal_url, proposal_sent_at, proposal_decided_at, rejection_reason, drive_url,
      work_started_at, advance_received_at, advance_amount_inr, balance_received_at, balance_amount_inr,
      changes_used, share_token, notes
    `).eq('id', id).maybeSingle(),
    supabase.from('project_checklist_items').select('id, service, label, optional, status, position')
      .eq('project_id', id).order('position').order('label'),
    supabase.from('project_events').select('id, kind, body, created_at, author:users!created_by(name, photo_url)')
      .eq('project_id', id).order('created_at', { ascending: false }).limit(100),
    // Through a function, not the tasks table: project tasks aren't readable by everyone who can see
    // the project (that put colleagues' tasks on every board), so the page asks for just its list.
    supabase.rpc('get_project_tasks', { p_project: id }),
  ])
  const err = error ?? itemsErr ?? eventsErr ?? tasksErr
  if (err) throw new Error(`Could not load the project: ${err.message}`)
  if (!p) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = p as any
  return {
    ...toSummary(r),
    first_call_at: r.first_call_at,
    proposal_url: r.proposal_url,
    proposal_sent_at: r.proposal_sent_at,
    proposal_decided_at: r.proposal_decided_at,
    rejection_reason: r.rejection_reason,
    drive_url: r.drive_url,
    work_started_at: r.work_started_at,
    advance_received_at: r.advance_received_at,
    advance_amount_inr: r.advance_amount_inr == null ? null : Number(r.advance_amount_inr),
    balance_received_at: r.balance_received_at,
    balance_amount_inr: r.balance_amount_inr == null ? null : Number(r.balance_amount_inr),
    changes_used: r.changes_used,
    share_token: r.share_token,
    notes: r.notes,
    checklist: (items ?? []) as ProjectChecklistItem[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: ((events ?? []) as any[]).map((e) => ({ ...e, author: one(e.author) })) as ProjectEvent[],
    tasks: ((tasks ?? []) as Array<{ id: string; title: string; status: string; due_date: string | null; assignee_name: string | null; assignee_photo_url: string | null }>)
      .map((t) => ({
        id: t.id, title: t.title, status: t.status, due_date: t.due_date,
        assignee: t.assignee_name || t.assignee_photo_url ? { name: t.assignee_name, photo_url: t.assignee_photo_url } : null,
      })),
  }
})

export type ProjectPerson = { id: string; name: string | null; email: string | null; photo_url: string | null; designation: string | null }

/** Everyone who can hold a role on a project — the internal team, external users included (a
    contract designer is exactly who might be on the Design team). */
export const fetchProjectPeople = cache(async (): Promise<ProjectPerson[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users')
    .select('id, name, email, photo_url, designation')
    .in('role', ['founder', 'admin', 'associate', 'general', 'hr'])
    .order('name')
  if (error) {
    console.error('[projects] people read failed:', error.message)
    return []
  }
  return (data ?? []) as ProjectPerson[]
})

export type PartnerProject = {
  id: string
  name: string
  company: string | null
  logo_url: string | null
  stage: import('@/lib/project-model').ProjectStage
  stage_changed_at: string
  created_at: string
  services: Array<{ service: import('@/lib/project-model').ProjectService; label: string; step: import('@/lib/project-model').TrackStep }>
  contact: { name: string | null; email: string | null; photo_url: string | null } | null
}

/** The projects a founder/admin credited to the signed-in partner (get_partner_projects). */
export const fetchPartnerProjects = cache(async (): Promise<PartnerProject[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_partner_projects')
  if (error) {
    console.error('[projects] partner projects read failed:', error.message)
    return []
  }
  return (data ?? []) as PartnerProject[]
})
